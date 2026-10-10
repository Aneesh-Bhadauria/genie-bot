import { anthropic } from "@ai-sdk/anthropic"
import { chat } from "@trigger.dev/sdk/ai"

// The transcript is kept by the default storage, keyed by chatId.
export const chatAgent = chat.agent({
  id: "chat",
  // `streamText` must be the one from the run argument, not the `ai` import
  run: async ({ messages, signal, streamText }) =>
    streamText({
      model: anthropic("claude-sonnet-5-5"),
      messages,
      abortSignal: signal,
    }),
})
