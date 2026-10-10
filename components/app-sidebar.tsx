import { formatDistanceToNowStrict } from "date-fns"

import { ChatList } from "@/components/chat-list"
import { ChatSearch } from "@/components/chat-search"
import { CreateMenu } from "@/components/create-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { UserMenu } from "@/components/user-menu"
import { getBots, getChats } from "@/queries/bot"

async function AppSidebar() {
  const [bots, allChats] = await Promise.all([getBots(), getChats()])
  const chats = allChats.map((chat) => {
    const members = chat.members.map((member) => member.bot)

    return {
      id: chat.id,
      // direct chats have no name of their own and use their bot's
      name: chat.name ?? members[0]?.name ?? "Chat",
      // a group whose bots were all deleted still needs a face
      avatars:
        members.length > 0 ? members.map((bot) => bot.avatar) : [chat.id],
      preview: chat.lastMessagePreview ?? "No messages yet",
      // formatted here, on the server, so it cannot differ on hydration
      time: formatDistanceToNowStrict(chat.lastMessageAt),
    }
  })

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex justify-end group-data-[collapsible=icon]:justify-center">
          <CreateMenu bots={bots} />
        </div>
        <ChatSearch
          chats={chats.map(({ id, name, avatars }) => ({ id, name, avatars }))}
        />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <ChatList chats={chats} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* Clerk's user button brings its own <button>, so this one is a div */}
            <SidebarMenuButton
              render={<div />}
              className="cursor-pointer p-0 group-data-[collapsible=icon]:p-0! hover:shadow-sm"
            >
              <UserMenu />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

export { AppSidebar }
