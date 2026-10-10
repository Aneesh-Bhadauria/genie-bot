import { auth } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"

import { Chat } from "@/components/chat"
import { ChatHeader } from "@/components/chat-header"
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
    <div className="flex h-svh flex-col">
      <ChatHeader name={chat.name ?? bot?.name ?? "Chat"} bot={bot} />
      <Chat key={chat.id} chatId={chat.id} />
    </div>
  )
}
