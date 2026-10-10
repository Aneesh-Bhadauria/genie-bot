import { anthropic } from "@ai-sdk/anthropic"
import { chat } from "@trigger.dev/sdk/ai"
import { stepCountIs } from "ai"
import { asc, eq } from "drizzle-orm"

import { db } from "@/db"
import { chatMembers } from "@/db/schema"

import { createTools, type ChatUIMessage } from "./tools"

// No Clerk session inside a task: the chat was already checked against the
// signed-in user when the session started (see actions/chat.ts).
// Group chats fall back to their first bot for now.
async function getChatBot(chatId: string) {
  const member = await db.query.chatMembers.findFirst({
    where: eq(chatMembers.chatId, chatId),
    orderBy: asc(chatMembers.joinedAt),
    with: {
      bot: {
        columns: { name: true, job: true, instructions: true, sandboxId: true },
      },
    },
  })

  return member?.bot
}

type ChatBot = NonNullable<Awaited<ReturnType<typeof getChatBot>>>

function buildSystemPrompt(bot: ChatBot) {
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

  return sections.join("\n\n")
}

// The transcript is kept by the default storage, keyed by chatId.
export const chatAgent = chat.withUIMessage<ChatUIMessage>().agent({
  id: "chat",
  // Declared here as well as on `streamText`, so screenshots are turned back
  // into images when earlier turns are replayed to the model.
  tools: ({ chatId }) =>
    createTools(async () => (await getChatBot(chatId))?.sandboxId ?? null),
  // Set every turn rather than once per chat, so edits to the bot apply to
  // the next message. The run argument's `streamText` picks the prompt up.
  onTurnStart: async ({ chatId }) => {
    const bot = await getChatBot(chatId)

    if (!bot) {
      throw new Error("This chat has no bot.")
    }

    chat.prompt.set(buildSystemPrompt(bot))
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
