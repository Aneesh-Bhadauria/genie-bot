"use client"

import { useState } from "react"
import { PlusIcon, UsersIcon } from "lucide-react"

import { BotDialog } from "@/components/bot-dialog"
import { GroupChatDialog } from "@/components/group-chat-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { usePaidFeatures } from "@/hooks/use-paid-features"
import { useUsageLimits } from "@/hooks/use-usage-limits"

function CreateMenu({
  bots,
}: {
  bots: React.ComponentProps<typeof GroupChatDialog>["bots"]
}) {
  const [botDialogOpen, setBotDialogOpen] = useState(false)
  const [groupChatDialogOpen, setGroupChatDialogOpen] = useState(false)
  const requireFeatures = usePaidFeatures()
  const requireUsage = useUsageLimits()

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="group-data-[collapsible=icon]:size-8"
            />
          }
        >
          <PlusIcon />
          <span className="sr-only">Create</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={async () => {
                // a new bot comes with a new, running sandbox
                if (
                  requireFeatures("bots", "sandboxes") &&
                  (await requireUsage("bots", "sandbox"))
                ) {
                  setBotDialogOpen(true)
                }
              }}
            >
              <PlusIcon />
              Create new bot
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                if (requireFeatures("bots")) {
                  setGroupChatDialogOpen(true)
                }
              }}
            >
              <UsersIcon />
              Create group chat
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* outside the menu, so they stay mounted once the menu closes */}
      <BotDialog open={botDialogOpen} onOpenChange={setBotDialogOpen} />
      <GroupChatDialog
        bots={bots}
        open={groupChatDialogOpen}
        onOpenChange={setGroupChatDialogOpen}
      />
    </>
  )
}

export { CreateMenu }
