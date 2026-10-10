"use server"

import { auth } from "@clerk/nextjs/server"
import { and, eq } from "drizzle-orm"
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

export async function updateBot(botId: string, input: BotInsert) {
  const { isAuthenticated, userId } = await auth()

  if (!isAuthenticated) {
    throw new Error("You must be signed in to edit a bot.")
  }

  const values = botInsertSchema.parse(input)

  const [bot] = await db
    .update(bots)
    .set({
      ...values,
      instructions: values.instructions || null,
    })
    .where(and(eq(bots.id, botId), eq(bots.userId, userId)))
    .returning()

  if (!bot) {
    throw new Error("Bot not found.")
  }

  // the bot's name and face also show in the sidebar and the chat header
  revalidatePath("/", "layout")

  return bot
}
