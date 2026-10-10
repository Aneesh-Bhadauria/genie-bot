"use client"

import { useState } from "react"
import { useChat } from "@ai-sdk/react"
import {
  useLoadTranscript,
  useTriggerChatTransport,
} from "@trigger.dev/sdk/chat/react"
import type { ChatTransport } from "ai"

import {
  loadTranscript,
  mintChatAccessToken,
  startChatSession,
} from "@/actions/chat"
import { CodeBlock } from "@/components/ai-elements/code-block"
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import { Image } from "@/components/ai-elements/image"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool"
import { ChatAvatar } from "@/components/chat-avatar"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { usePaidFeatures } from "@/hooks/use-paid-features"
import { useUsageLimits } from "@/hooks/use-usage-limits"
import type { chatAgent } from "@/trigger/chat"
import type { ChatUIMessage } from "@/trigger/tools"

type ChatBot = { id: string; name: string; avatar: string }

type ChatToolPart = Extract<
  ChatUIMessage["parts"][number],
  { type: `tool-${string}` }
>

// what the tool is doing, in place of its raw name
function getToolTitle(part: ChatToolPart) {
  switch (part.type) {
    case "tool-bash":
      return part.input?.command ?? "Run command"
    case "tool-readFile":
      return `Read ${part.input?.path ?? "file"}`
    case "tool-writeFile":
      return `Write ${part.input?.path ?? "file"}`
    case "tool-listFiles":
      return `List ${part.input?.path ?? "files"}`
    case "tool-mouseClick":
      return `${part.input?.double ? "Double-click" : "Click"} at ${part.input?.x ?? "…"}, ${part.input?.y ?? "…"}`
    case "tool-mouseMove":
      return `Move mouse to ${part.input?.x ?? "…"}, ${part.input?.y ?? "…"}`
    case "tool-mouseDrag":
      return `Drag from ${part.input?.startX ?? "…"}, ${part.input?.startY ?? "…"} to ${part.input?.endX ?? "…"}, ${part.input?.endY ?? "…"}`
    case "tool-mouseScroll":
      return `Scroll ${part.input?.direction ?? ""}`
    case "tool-keyboardType":
      return `Type "${part.input?.text ?? ""}"`
    case "tool-keyboardPress":
      return `Press ${[...(part.input?.modifiers ?? []), part.input?.key ?? "key"].join("+")}`
    case "tool-viewScreen":
      return "Look at the screen"
    case "tool-showScreen":
      return "Show the screen"
    default:
      return part satisfies never
  }
}

// the result, with shell and file text as text rather than escaped JSON
function getToolOutput(part: ChatToolPart) {
  if (part.state !== "output-available") {
    return undefined
  }

  switch (part.type) {
    case "tool-bash":
      return (
        <CodeBlock
          code={`${part.output.output}
exit code ${part.output.exitCode}`}
          language="log"
        />
      )
    case "tool-readFile":
      return <CodeBlock code={part.output.content} language="log" />
    case "tool-viewScreen":
    case "tool-showScreen":
      // never the screenshot itself: only showScreen is shown, as an image
      return undefined
    default:
      return part.output
  }
}

function ChatTool({ part }: { part: ChatToolPart }) {
  if (part.type === "tool-showScreen" && part.state === "output-available") {
    return (
      <Image
        alt="The sandbox screen"
        base64={part.output.base64}
        mediaType={part.output.mediaType}
        uint8Array={new Uint8Array()}
        className="border"
      />
    )
  }

  return (
    <Tool defaultOpen={part.state === "output-error"}>
      <ToolHeader
        type={part.type}
        state={part.state}
        title={getToolTitle(part)}
      />
      <ToolContent>
        {part.type === "tool-viewScreen" || part.type === "tool-showScreen" ? (
          <p className="text-sm text-muted-foreground">
            {part.type === "tool-viewScreen"
              ? "A screenshot only the bot sees."
              : "Taking a screenshot to show you."}
          </p>
        ) : (
          <ToolInput input={part.input} />
        )}
        <ToolOutput output={getToolOutput(part)} errorText={part.errorText} />
      </ToolContent>
    </Tool>
  )
}

// The face and name of the bot that wrote a reply, in a group chat. Nothing
// for the user's messages, for direct chats, which pass no bots, or for a
// reply whose bot has since left the chat.
function MessageAuthor({
  message,
  bots,
}: {
  message: ChatUIMessage
  bots: ChatBot[]
}) {
  const author =
    message.role === "assistant"
      ? bots.find((bot) => bot.id === message.metadata?.botId)
      : undefined

  if (!author) {
    return null
  }

  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <ChatAvatar seed={author.avatar} className="size-5" />
      {author.name}
    </div>
  )
}

// `bots` are the members of a group chat, for picking who answers; a direct
// chat passes none and its one bot always does.
function Chat({ chatId, bots }: { chatId: string; bots?: ChatBot[] }) {
  const transport = useTriggerChatTransport<typeof chatAgent>({
    task: "chat",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) =>
      startChatSession({ chatId, clientData }),
  })
  const { messages, isLoading } = useLoadTranscript(chatId, loadTranscript, {
    transport,
  })

  // useChat must mount with the saved transcript, so wait for it to load
  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <ChatConversation
      chatId={chatId}
      bots={bots}
      // the stored transcript is untyped; its tool parts are this agent's
      initialMessages={messages as ChatUIMessage[]}
      transport={transport}
    />
  )
}

function ChatConversation({
  chatId,
  bots = [],
  initialMessages,
  transport,
}: {
  chatId: string
  bots?: ChatBot[]
  initialMessages: ChatUIMessage[]
  transport: ChatTransport<ChatUIMessage>
}) {
  const [input, setInput] = useState("")
  const [botId, setBotId] = useState(bots[0]?.id)
  const bot = bots.find((bot) => bot.id === botId)
  const requireFeatures = usePaidFeatures()
  const requireUsage = useUsageLimits()
  const { messages, sendMessage, status, stop } = useChat<ChatUIMessage>({
    id: chatId,
    messages: initialMessages,
    transport,
    // pick a reply back up if the page reloaded while it was streaming
    resume: initialMessages.length > 0,
    // the agent's own refusals, such as a limit reached mid-conversation
    onError: (error) =>
      toast.add({
        type: "error",
        title: "The bot could not reply",
        description: error.message,
      }),
  })

  async function handleSubmit(message: PromptInputMessage) {
    if (!message.text.trim()) {
      return
    }

    // Talking to a bot is paid and takes AI usage. When refused, the text
    // stays in the composer.
    if (!requireFeatures("bots") || !(await requireUsage("ai"))) {
      return
    }

    // in a group chat, tell the agent which bot should answer this message
    sendMessage(
      { text: message.text },
      botId ? { metadata: { botId } } : undefined
    )
    setInput("")
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation>
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.map((message) => (
            <Message from={message.role} key={message.id}>
              <MessageAuthor message={message} bots={bots} />
              <MessageContent>
                {message.parts.map((part, index) => {
                  if (part.type === "text") {
                    return (
                      <MessageResponse key={`${message.id}-${index}`}>
                        {part.text}
                      </MessageResponse>
                    )
                  }

                  if (part.type.startsWith("tool-")) {
                    return (
                      <ChatTool
                        key={`${message.id}-${index}`}
                        part={part as ChatToolPart}
                      />
                    )
                  }

                  return null
                })}
              </MessageContent>
            </Message>
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="mx-auto w-full max-w-3xl p-4 pt-0">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea
            value={input}
            placeholder="What would you like to know?"
            onChange={(event) => setInput(event.currentTarget.value)}
          />
          <PromptInputFooter className={bot ? undefined : "justify-end"}>
            {bot && (
              <PromptInputTools>
                <PromptInputSelect
                  value={botId}
                  onValueChange={(value) => {
                    if (typeof value === "string") {
                      setBotId(value)
                    }
                  }}
                >
                  <PromptInputSelectTrigger
                    size="sm"
                    aria-label="Bot to talk to"
                  >
                    <PromptInputSelectValue>
                      <ChatAvatar seed={bot.avatar} className="size-4" />
                      {bot.name}
                    </PromptInputSelectValue>
                  </PromptInputSelectTrigger>
                  <PromptInputSelectContent>
                    {bots.map((bot) => (
                      <PromptInputSelectItem key={bot.id} value={bot.id}>
                        <ChatAvatar seed={bot.avatar} className="size-4" />
                        {bot.name}
                      </PromptInputSelectItem>
                    ))}
                  </PromptInputSelectContent>
                </PromptInputSelect>
              </PromptInputTools>
            )}
            <PromptInputSubmit
              status={status}
              onStop={stop}
              disabled={status === "ready" && !input.trim()}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}

export { Chat }
