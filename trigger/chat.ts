import { anthropic } from "@ai-sdk/anthropic"
import { chat } from "@trigger.dev/sdk/ai"
import { stepCountIs } from "ai"
import { asc, eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db"
import { chatMembers } from "@/db/schema"
import { assertUsage, getAiCost, recordUsage } from "@/lib/usage"

import { createTools, type ChatUIMessage } from "./tools"

// The bots of a chat, in the order they joined: one for a direct chat,
// several for a group.
//
// No Clerk session inside a task: the chat was already checked against the
// signed-in user when the session started (see actions/chat.ts).
async function getChatBots(chatId: string) {
  const members = await db.query.chatMembers.findMany({
    where: eq(chatMembers.chatId, chatId),
    orderBy: asc(chatMembers.joinedAt),
    with: {
      bot: {
        columns: {
          id: true,
          // a chat's bots all belong to the chat's owner
          userId: true,
          name: true,
          job: true,
          instructions: true,
          sandboxId: true,
        },
      },
    },
  })

  return members.map((member) => member.bot)
}

type ChatBot = Awaited<ReturnType<typeof getChatBots>>[number]

// `botId` is the bot the user picked to answer in a group chat. It comes from
// the browser, so it only ever selects among the chat's own bots. Without it
// the first bot answers, which is the only bot of a direct chat.
function pickBot(bots: ChatBot[], botId?: string) {
  return botId ? bots.find((bot) => bot.id === botId) : bots[0]
}

// Tells a bot in a group chat who else is there and who wrote each earlier
// reply. Without it every assistant message in the history reads as its own.
function buildGroupSection(
  bot: ChatBot,
  bots: ChatBot[],
  messages: ChatUIMessage[]
) {
  const others = bots.filter((other) => other.id !== bot.id)
  const authors = messages
    .filter((message) => message.role === "assistant")
    .map((message) => {
      const author = bots.find((bot) => bot.id === message.metadata?.botId)

      if (!author) {
        return "an unknown bot"
      }

      return author.id === bot.id ? "you" : author.name
    })

  const sections = [
    `This is a group chat between the user and several bots: you and ${others.map((other) => `${other.name} (${other.job})`).join(", ")}. The user picks which bot answers each message, and this time picked you.`,
    "The assistant replies earlier in this conversation were therefore not all written by you. Treat another bot's reply as something that bot said: you can build on it or disagree with it, but do not claim it as your own. Each bot has its own sandbox, so files and windows another bot mentions are not in yours.",
  ]

  if (authors.length > 0) {
    sections.push(
      `In order, the assistant replies so far were written by: ${authors.map((author, index) => `${index + 1}. ${author}`).join(", ")}.`
    )
  }

  return sections.join("\n\n")
}

function buildSystemPrompt(
  bot: ChatBot,
  bots: ChatBot[],
  messages: ChatUIMessage[]
) {
  const sections = [
    `You are ${bot.name}, an AI teammate. Your job: ${bot.job}.`,
    `Your purpose is to help the person you are chatting with by doing that job well. Stay in your role as ${bot.name}, and say so plainly when a request falls outside your job.`,
  ]

  if (bot.instructions) {
    sections.push(
      `How you should go about your job:\n<instructions>\n${bot.instructions}\n</instructions>`
    )
  }

  if (bot.sandboxId) {
    sections.push(
      [
        `You have your own sandbox: an isolated Linux computer with its own filesystem, processes, network and a graphical desktop, dedicated to you alone. It was created together with you, is not shared with any other bot, and stays yours across conversations. Its id is ${bot.sandboxId}.`,
        "Your tools all act on that sandbox. Use bash and the file tools for anything a shell can do; your home directory is /home/daytona. Use the mouse and keyboard tools for graphical applications.",
        "The desktop is 1024x768 pixels, and screen coordinates are pixels from its top-left corner. You cannot see the screen unless you look: call viewScreen before clicking and again after acting to check what happened, rather than guessing coordinates. viewScreen is for your own eyes and the user never sees it. Call showScreen only when the user asks to see the screen or what is on it.",
        "Do the work with your tools instead of describing what you would do, and report what actually happened, including failures.",
      ].join("\n\n")
    )
  }

  if (bots.length > 1) {
    sections.push(buildGroupSection(bot, bots, messages))
  }

  return sections.join("\n\n")
}

// Sent as metadata with each message; direct chats send none.
const clientDataSchema = z.object({ botId: z.string().optional() }).nullish()

// The transcript is kept by the default storage, keyed by chatId.
export const chatAgent = chat.withUIMessage<ChatUIMessage>().agent({
  id: "chat",
  clientDataSchema,
  // Declared here as well as on `streamText`, so screenshots are turned back
  // into images when earlier turns are replayed to the model.
  tools: ({ chatId, clientData }) =>
    createTools(async () => {
      const bot = pickBot(await getChatBots(chatId), clientData?.botId)

      if (!bot?.sandboxId) {
        return null
      }

      // A sandbox is only woken while its owner has sandbox hours left. This
      // fails the tool call, and the bot tells the user why.
      await assertUsage(bot.userId, "sandbox")

      return bot.sandboxId
    }),
  // Set every turn rather than once per chat: a group chat can be answered
  // by a different bot each turn, and edits to a bot apply to the next
  // message. The run argument's `streamText` picks the prompt up.
  onTurnStart: async ({ chatId, clientData, uiMessages }) => {
    const bots = await getChatBots(chatId)
    const bot = pickBot(bots, clientData?.botId)

    if (!bot) {
      throw new Error("That bot is not in this chat.")
    }

    // Checked here, on every turn, because messages reach this task without
    // passing through the app's server. The message is shown to the user.
    await assertUsage(bot.userId, "ai")

    chat.prompt.set(buildSystemPrompt(bot, bots, uiMessages))
    // stamps the reply with its author, for the chat to show a face next to
    // it and for later turns to tell the bots' replies apart
    chat.setUIMessageStreamOptions({
      messageMetadata: () => ({ botId: bot.id }),
    })
  },
  // Charges the turn's tokens to the chat's owner. An errored turn can still
  // have used tokens, and has no usage only when the model was never called.
  onTurnComplete: async ({ chatId, clientData, usage }) => {
    const bot = pickBot(await getChatBots(chatId), clientData?.botId)

    if (!usage || !bot) {
      return
    }

    await recordUsage({
      userId: bot.userId,
      kind: "ai",
      amount: getAiCost(usage),
      botId: bot.id,
      chatId,
    })
  },
  // `streamText` must be the one from the run argument, not the `ai` import
  run: async ({ messages, tools, signal, streamText }) =>
    streamText({
      model: anthropic("claude-sonnet-5-5"),
      messages,
      tools,
      abortSignal: signal,
      // working a desktop takes many look-act-look steps
      stopWhen: stepCountIs(50),
    }),
})
