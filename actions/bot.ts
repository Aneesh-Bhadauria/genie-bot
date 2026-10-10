"use server"

import { auth } from "@clerk/nextjs/server"
import { DaytonaNotFoundError } from "@daytona/sdk"
import { and, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/db"
import {
  botInsertSchema,
  bots,
  chatMembers,
  chats,
  type BotInsert,
} from "@/db/schema"
import { daytona } from "@/lib/daytona"

export async function createBot(input: BotInsert) {
  const { isAuthenticated, userId } = await auth()

  if (!isAuthenticated) {
    throw new Error("You must be signed in to create a bot.")
  }

  const values = botInsertSchema.parse(input)

  // every bot gets its own sandbox; nothing runs in it yet
  const sandbox = await daytona.create()

  let bot
  try {
    // the bot, its direct chat and the membership succeed or fail together
    bot = await db.transaction(async (tx) => {
      const [bot] = await tx
        .insert(bots)
        .values({
          ...values,
          instructions: values.instructions || null,
          sandboxId: sandbox.id,
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
  } catch (error) {
    // do not leave a sandbox behind for a bot that was never saved
    await daytona.delete(sandbox)
    throw error
  }

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

export async function deleteBot(botId: string) {
  const { isAuthenticated, userId } = await auth()

  if (!isAuthenticated) {
    throw new Error("You must be signed in to delete a bot.")
  }

  const bot = await db.query.bots.findFirst({
    where: and(eq(bots.id, botId), eq(bots.userId, userId)),
  })

  if (!bot) {
    throw new Error("Bot not found.")
  }

  // the sandbox goes first: if this fails the bot stays and can be retried
  if (bot.sandboxId) {
    try {
      await daytona.delete(await daytona.get(bot.sandboxId))
    } catch (error) {
      // already gone is fine
      if (!(error instanceof DaytonaNotFoundError)) {
        throw error
      }
    }
  }

  await db.transaction(async (tx) => {
    const memberships = await tx
      .select({ chatId: chatMembers.chatId })
      .from(chatMembers)
      .where(eq(chatMembers.botId, bot.id))

    // a direct chat is nothing without its bot; group chats only lose a member
    if (memberships.length > 0) {
      await tx.delete(chats).where(
        and(
          inArray(
            chats.id,
            memberships.map((membership) => membership.chatId)
          ),
          eq(chats.kind, "direct")
        )
      )
    }

    // cascades to the bot's remaining chat memberships
    await tx.delete(bots).where(eq(bots.id, bot.id))
  })

  revalidatePath("/", "layout")
}
