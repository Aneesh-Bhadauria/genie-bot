import { auth } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"

import { Chat } from "@/components/chat"
import { ChatHeader } from "@/components/chat-header"
import {
  DesktopPanel,
  DesktopPanelProvider,
} from "@/components/desktop-panel"
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

  // group chats fall back to their first bot for now
  const bot = chat.members[0]?.bot

  return (
    <DesktopPanelProvider>
      <ResizablePanelGroup orientation="horizontal" className="h-svh">
        <ResizablePanel id="chat" minSize="30%">
          <div className="flex h-full flex-col">
            <ChatHeader name={chat.name ?? bot?.name ?? "Chat"} bot={bot} />
            <Chat key={chat.id} chatId={chat.id} />
          </div>
        </ResizablePanel>
        {/* toggled by the desktop button in the chat header */}
        <DesktopPanel>
          <ResizableHandle />
          <ResizablePanel id="desktop" defaultSize="40%" minSize="20%">
            <DesktopView chatId={chat.id} />
          </ResizablePanel>
        </DesktopPanel>
      </ResizablePanelGroup>
    </DesktopPanelProvider>
  )
}
