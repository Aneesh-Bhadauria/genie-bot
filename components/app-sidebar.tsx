import { UserButton } from "@clerk/nextjs"
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
import { getChats } from "@/queries/bot"

async function AppSidebar() {
  const chats = (await getChats()).map((chat) => {
    // group chats fall back to their first bot for now
    const bot = chat.members[0]?.bot

    return {
      id: chat.id,
      name: chat.name ?? bot?.name ?? "Chat",
      avatar: bot?.avatar ?? chat.id,
      preview: chat.lastMessagePreview ?? "No messages yet",
      // formatted here, on the server, so it cannot differ on hydration
      time: formatDistanceToNowStrict(chat.lastMessageAt),
    }
  })

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex justify-end group-data-[collapsible=icon]:justify-center">
          <CreateMenu />
        </div>
        <ChatSearch
          chats={chats.map(({ id, name, avatar }) => ({ id, name, avatar }))}
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
            {/* UserButton brings its own <button>, so the menu button is a div */}
            <SidebarMenuButton
              render={<div />}
              className="cursor-pointer p-0 group-data-[collapsible=icon]:p-0! hover:shadow-sm"
            >
              <UserButton
                showName
                appearance={{
                  // `!` so these win over Clerk's own component styles
                  elements: {
                    rootBox: "size-full!",
                    // fills the menu button, so all of it is clickable
                    userButtonTrigger:
                      "size-full! cursor-pointer! justify-start! rounded-md! p-2! focus:shadow-none! focus-visible:ring-2! focus-visible:ring-sidebar-ring! group-data-[collapsible=icon]:justify-center! group-data-[collapsible=icon]:p-0!",
                    userButtonBox: "min-w-0 flex-row! gap-2!",
                    // Clerk renders the name before the avatar
                    userButtonAvatarBox: "order-1! size-5!",
                    userButtonOuterIdentifier:
                      "order-2! truncate p-0! text-sm! font-normal! text-sidebar-foreground! group-data-[collapsible=icon]:hidden!",
                  },
                }}
              />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

export { AppSidebar }
