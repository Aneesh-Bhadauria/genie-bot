import { auth } from "@clerk/nextjs/server"
import { and, asc, eq } from "drizzle-orm"

import { db } from "@/db"
import { chatMembers, chats } from "@/db/schema"

// One of the signed-in user's chats with its bots, or undefined when the chat
// does not exist or belongs to someone else.
export async function getChat(chatId: string) {
  const { isAuthenticated, userId } = await auth()

  if (!isAuthenticated) {
    throw new Error("You must be signed in to open a chat.")
  }

  return db.query.chats.findFirst({
    where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
    with: {
      members: {
        orderBy: asc(chatMembers.joinedAt),
        with: {
          bot: {
            columns: {
              id: true,
              name: true,
              avatar: true,
              job: true,
              instructions: true,
            },
          },
        },
      },
    },
  })
}

// The sandbox of one of the signed-in user's chats, or null when the chat is
// not theirs or its bot has none. Group chats fall back to their first bot.
export async function getChatSandboxId(chatId: string) {
  const { isAuthenticated, userId } = await auth()

  if (!isAuthenticated) {
    throw new Error("You must be signed in to open a chat.")
  }

  const chat = await db.query.chats.findFirst({
    where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
    columns: { id: true },
    with: {
      members: {
        orderBy: asc(chatMembers.joinedAt),
        limit: 1,
        columns: { botId: true },
        with: { bot: { columns: { sandboxId: true } } },
      },
    },
  })

  return chat?.members[0]?.bot.sandboxId ?? null
}
