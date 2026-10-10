import { auth } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"

import { Chat } from "@/components/chat"
import { ChatHeader } from "@/components/chat-header"
import { DesktopPanel, DesktopPanelProvider } from "@/components/desktop-panel"
import { DesktopView } from "@/components/desktop-view"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { getChat } from "@/queries/chat"

export default async function Page({
  params,
}: {
  params: Promise<{ chatId: string }>
}) {
  await auth.protect()

  const { chatId } = await params
  const chat = await getChat(chatId)

  if (!chat) {
    notFound()
  }

  const bots = chat.members.map((member) => member.bot)
  const isGroup = chat.kind === "group"

  return (
    <DesktopPanelProvider>
      {/* The group sets its own height to 100%, so the viewport height has
          to come from a parent; otherwise it grows with the messages and the
          whole page scrolls. */}
      <div className="h-svh">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel id="chat" minSize="30%">
            <div className="flex h-full flex-col">
              <ChatHeader
                name={chat.name ?? bots[0]?.name ?? "Chat"}
                // a group whose bots were all deleted still needs a face
                avatars={
                  bots.length > 0 ? bots.map((bot) => bot.avatar) : [chat.id]
                }
                // only a direct chat's bot is edited from the header
                bot={isGroup ? undefined : bots[0]}
              />
              <Chat
                key={chat.id}
                chatId={chat.id}
                // a group chat picks which of its bots answers
                bots={
                  isGroup
                    ? bots.map(({ id, name, avatar }) => ({ id, name, avatar }))
                    : undefined
                }
              />
            </div>
          </ResizablePanel>
          {/* Toggled by the desktop button in the chat header. Group chats
              have neither: a desktop belongs to one bot. */}
          {!isGroup && (
            <DesktopPanel>
              <ResizableHandle />
              <ResizablePanel id="desktop" defaultSize="40%" minSize="20%">
                <DesktopView chatId={chat.id} />
              </ResizablePanel>
            </DesktopPanel>
          )}
        </ResizablePanelGroup>
      </div>
    </DesktopPanelProvider>
  )
}
