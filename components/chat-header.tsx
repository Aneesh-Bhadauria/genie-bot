import { BotDialog } from "@/components/bot-dialog"
import { DesktopPanelToggle } from "@/components/desktop-panel"
import { GroupChatAvatar } from "@/components/group-chat-avatar"
import { Button } from "@/components/ui/button"

// `bot` is the one bot of a direct chat, which the header lets you edit;
// group chats pass none and only show their name and faces. They have no
// desktop panel to toggle either.
function ChatHeader({
  name,
  avatars,
  bot,
}: {
  name: string
  avatars: string[]
  bot?: React.ComponentProps<typeof BotDialog>["bot"]
}) {
  return (
    <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b px-4">
      {bot ? (
        <BotDialog
          bot={bot}
          trigger={
            <Button variant="ghost" size="sm" className="-ml-2 min-w-0">
              <GroupChatAvatar seeds={avatars} className="size-5" />
              <span className="truncate">{name}</span>
            </Button>
          }
        />
      ) : (
        <div className="flex min-w-0 items-center gap-1.5">
          <GroupChatAvatar seeds={avatars} className="size-5" />
          <span className="truncate text-sm font-medium">{name}</span>
        </div>
      )}
      {bot && <DesktopPanelToggle />}
    </header>
  )
}

export { ChatHeader }
