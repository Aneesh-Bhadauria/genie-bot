"use client"

import Link from "next/link"
import { useParams } from "next/navigation"

import { GroupChatAvatar } from "@/components/group-chat-avatar"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

function ChatList({
  chats,
}: {
  chats: {
    id: string
    name: string
    avatars: string[]
    preview: string
    time: string
  }[]
}) {
  // the layout does not re-render on navigation, so read the route here
  const { chatId } = useParams<{ chatId?: string }>()

  return (
    <SidebarMenu>
      {chats.map((chat) => (
        <SidebarMenuItem key={chat.id}>
          <SidebarMenuButton
            size="lg"
            isActive={chat.id === chatId}
            tooltip={chat.name}
            className="group-data-[collapsible=icon]:justify-center"
            render={<Link href={`/chats/${chat.id}`} />}
          >
            <GroupChatAvatar seeds={chat.avatars} className="size-6" />
            <div className="flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate font-medium">{chat.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {chat.time}
                </span>
              </div>
              <span className="truncate text-xs text-muted-foreground">
                {chat.preview}
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}

export { ChatList }
