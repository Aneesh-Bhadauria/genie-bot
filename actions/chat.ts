"use server"

import { auth } from "@trigger.dev/sdk"
import { chat, defaultStorage } from "@trigger.dev/sdk/ai"

import { getChat } from "@/queries/chat"

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
