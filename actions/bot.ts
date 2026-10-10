"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"

import { db } from "@/db"
import {
  botInsertSchema,
  bots,
  chatMembers,
  chats,
  type BotInsert,
} from "@/db/schema"

export async function createBot(input: BotInsert) {
  const { isAuthenticated, userId } = await auth()

  if (!isAuthenticated) {
    throw new Error("You must be signed in to create a bot.")
  }

  const values = botInsertSchema.parse(input)

  // the bot, its direct chat and the membership succeed or fail together
  const bot = await db.transaction(async (tx) => {
    const [bot] = await tx
      .insert(bots)
      .values({
        ...values,
        instructions: values.instructions || null,
        userId,
      })
      .returning()

    const [chat] = await tx
      .insert(chats)
      .values({ userId, kind: "direct" })
      .returning({ id: chats.id })

    await tx.insert(chatMembers).values({ chatId: chat.id, botId: bot.id })

    return bot
  })

  revalidatePath("/")

  return bot
}
