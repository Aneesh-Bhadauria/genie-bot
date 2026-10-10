"use client"

import { UserButton } from "@clerk/nextjs"
import { GaugeIcon } from "lucide-react"

import { USAGE_PATH } from "@/lib/billing"

// Clerk's user button, sized to fill the sidebar menu button it sits in, with
// a link to the usage page added to its menu. A client component because the
// menu items are composed from `UserButton`'s own parts.
function UserMenu() {
  return (
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
    >
      <UserButton.MenuItems>
        <UserButton.Link
          label="Usage"
          labelIcon={<GaugeIcon className="size-4" />}
          href={USAGE_PATH}
        />
        {/* Clerk's own items, named to keep them below the link */}
        <UserButton.Action label="manageAccount" />
        <UserButton.Action label="signOut" />
      </UserButton.MenuItems>
    </UserButton>
  )
}

export { UserMenu }
