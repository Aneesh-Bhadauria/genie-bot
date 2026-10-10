"use server"

import { auth } from "@trigger.dev/sdk"
import { chat, defaultStorage } from "@trigger.dev/sdk/ai"

import { daytona } from "@/lib/daytona"
import { getChat, getChatSandboxId } from "@/queries/chat"

// noVNC, the browser VNC client every sandbox serves
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

export async function startChatSession(
  input: Parameters<typeof startSession>[0]
) {
  await assertOwnsChat(input.chatId)

  return startSession(input)
}

export async function mintChatAccessToken(chatId: string) {
  await assertOwnsChat(chatId)

  return auth.createPublicToken({
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

// A link to the live desktop of the chat's sandbox, for an iframe. Anyone
// holding it can control the desktop until it expires, so it is only handed
// to the chat's owner. Returns the failure instead of throwing, so the
// message survives a production build.
export async function getDesktopUrl(
  chatId: string
): Promise<{ url: string } | { error: string }> {
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
    const url = new URL("/vnc.html", signed.url)
    // connect straight away and fit the desktop to the frame
    url.searchParams.set("autoconnect", "true")
    url.searchParams.set("reconnect", "true")
    url.searchParams.set("resize", "scale")

    return { url: url.toString() }
  } catch (error) {
    console.error(error)

    return { error: "The desktop could not be started." }
  }
}
