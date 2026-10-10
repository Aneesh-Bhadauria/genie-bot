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
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool"
import { Spinner } from "@/components/ui/spinner"
import type { chatAgent } from "@/trigger/chat"
import type { ChatUIMessage } from "@/trigger/tools"

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

function Chat({ chatId }: { chatId: string }) {
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
      // the stored transcript is untyped; its tool parts are this agent's
      initialMessages={messages as ChatUIMessage[]}
      transport={transport}
    />
  )
}

function ChatConversation({
  chatId,
  initialMessages,
  transport,
}: {
  chatId: string
  initialMessages: ChatUIMessage[]
  transport: ChatTransport<ChatUIMessage>
}) {
  const [input, setInput] = useState("")
  const { messages, sendMessage, status, stop } = useChat<ChatUIMessage>({
    id: chatId,
    messages: initialMessages,
    transport,
    // pick a reply back up if the page reloaded while it was streaming
    resume: initialMessages.length > 0,
  })

  function handleSubmit(message: PromptInputMessage) {
    if (!message.text.trim()) {
      return
    }

    sendMessage({ text: message.text })
    setInput("")
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation>
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.map((message) => (
            <Message from={message.role} key={message.id}>
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
          <PromptInputFooter className="justify-end">
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
