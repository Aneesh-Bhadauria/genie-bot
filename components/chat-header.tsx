import { MonitorIcon } from "lucide-react"

import { BotDialog } from "@/components/bot-dialog"
import { ChatAvatar } from "@/components/chat-avatar"
import { Button } from "@/components/ui/button"

function ChatHeader({
  name,
  bot,
}: {
  name: string
  bot: React.ComponentProps<typeof BotDialog>["bot"]
}) {
  return (
    <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b px-4">
      {bot ? (
        <BotDialog
          bot={bot}
          trigger={
            <Button variant="ghost" size="sm" className="-ml-2 min-w-0">
              <ChatAvatar seed={bot.avatar} className="size-5" />
              <span className="truncate">{name}</span>
            </Button>
          }
        />
      ) : (
        <span className="truncate text-sm font-medium">{name}</span>
      )}
      <Button variant="ghost" size="icon-sm">
        <MonitorIcon />
        <span className="sr-only">Desktop</span>
      </Button>
    </header>
  )
}

export { ChatHeader }
