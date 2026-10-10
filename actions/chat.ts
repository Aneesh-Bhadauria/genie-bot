"use server"

import { auth } from "@clerk/nextjs/server"
import { auth as triggerAuth } from "@trigger.dev/sdk"
import { chat, defaultStorage } from "@trigger.dev/sdk/ai"
import { and, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/db"
import {
  bots,
  chatMembers,
  chats,
  groupChatInsertSchema,
  type GroupChatInsert,
} from "@/db/schema"
import { assertFeatures, hasFeatures, usageLimitMessages } from "@/lib/billing"
import { daytona } from "@/lib/daytona"
import { assertUsage, getExhausted, getUsage } from "@/lib/usage"
import { getChat, getChatSandboxId } from "@/queries/chat"

// where every sandbox serves its desktop over VNC-in-WebSocket
const VNC_PORT = 6080
const DESKTOP_URL_TTL_SECONDS = 60 * 60

const startSession = chat.createStartSessionAction("chat")
const loadStoredTranscript = chat.createLoadTranscriptAction(defaultStorage)

// The Trigger.dev helpers take chatId from the browser and do no authorization
// of their own, so every action first checks the signed-in user owns the chat.
async function assertOwnsChat(chatId: string) {
  // getChat throws when signed out and only finds the user's own chats
  const found = await getChat(chatId)

  if (!found) {
    throw new Error("Chat not found.")
  }
}

// Talking to a bot is paid. Starting a session and renewing its token are the
// two points every conversation has to pass through on this server.
async function assertCanChat(chatId: string) {
  const { isAuthenticated, userId, has } = await auth()

  if (!isAuthenticated) {
    throw new Error("You must be signed in to chat.")
  }

  assertFeatures(has, "bots")
  await assertUsage(userId, "ai")
  await assertOwnsChat(chatId)
}

export async function startChatSession(
  input: Parameters<typeof startSession>[0]
) {
  await assertCanChat(input.chatId)

  return startSession(input)
}

export async function mintChatAccessToken(chatId: string) {
  await assertCanChat(chatId)

  return triggerAuth.createPublicToken({
    scopes: { read: { sessions: chatId }, write: { sessions: chatId } },
    expirationTime: "1h",
  })
}

export async function loadTranscript(
  input: Parameters<typeof loadStoredTranscript>[0]
) {
  await assertOwnsChat(input.chatId)

  return loadStoredTranscript(input)
}

// The WebSocket address of the live desktop of the chat's sandbox, for the
// VNC client in the browser. Anyone holding it can control the desktop until
// it expires, so it is only handed to the chat's owner. Returns the failure
// instead of throwing, so the message survives a production build.
export async function getDesktopUrl(
  chatId: string
): Promise<{ url: string } | { error: string }> {
  const { isAuthenticated, userId, has } = await auth()

  if (!isAuthenticated) {
    throw new Error("You must be signed in to open a desktop.")
  }

  const usage = await getUsage(userId)

  // connecting to a sandbox is paid
  if (!hasFeatures(has, "sandboxes") || !usage) {
    return { error: "The desktop needs a paid plan." }
  }

  // and it wakes the sandbox, which takes sandbox hours
  if (getExhausted(usage, "sandbox")) {
    return { error: usageLimitMessages.sandbox }
  }

  // throws when signed out and only finds the user's own chats
  const sandboxId = await getChatSandboxId(chatId)

  if (!sandboxId) {
    return { error: "This bot has no sandbox." }
  }

  try {
    const sandbox = await daytona.get(sandboxId)

    // the sandbox stops itself when idle
    if (sandbox.state !== "started") {
      await sandbox.start()
    }

    // a no-op when the desktop is already up
    await sandbox.computerUse.start()

    const signed = await sandbox.getSignedPreviewUrl(
      VNC_PORT,
      DESKTOP_URL_TTL_SECONDS
    )
    // Only the socket is used, not the noVNC page served next to it: Daytona
    // puts a warning page in front of pages opened in a browser, on every
    // new link, but lets WebSocket connections straight through.
    const url = new URL("/websockify", signed.url)
    url.protocol = "wss:"

    return { url: url.toString() }
  } catch (error) {
    console.error(error)

    return { error: "The desktop could not be started." }
  }
}

export async function createGroupChat(input: GroupChatInsert) {
  const { isAuthenticated, userId, has } = await auth()

  if (!isAuthenticated) {
    throw new Error("You must be signed in to create a group chat.")
  }

  assertFeatures(has, "bots")

  const values = groupChatInsertSchema.parse(input)
  const botIds = [...new Set(values.botIds)]

  // only the user's own bots can be put in a group
  const owned = await db
    .select({ id: bots.id })
    .from(bots)
    .where(and(inArray(bots.id, botIds), eq(bots.userId, userId)))

  if (owned.length !== botIds.length) {
    throw new Error("Bot not found.")
  }

  // the chat and its memberships succeed or fail together
  const chat = await db.transaction(async (tx) => {
    const [chat] = await tx
      .insert(chats)
      .values({ userId, kind: "group", name: values.name })
      .returning()

    const now = Date.now()

    await tx.insert(chatMembers).values(
      botIds.map((botId, index) => ({
        chatId: chat.id,
        botId,
        // a millisecond apart, so members keep the order they were picked in
        joinedAt: new Date(now + index),
      }))
    )

    return chat
  })

  // the new chat shows in the sidebar, which lives in the layout
  revalidatePath("/", "layout")

  return chat
}
