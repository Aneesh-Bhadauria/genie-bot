"use client"

import { createContext, use, useState } from "react"
import { MonitorIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { usePaidFeatures } from "@/hooks/use-paid-features"
import { useUsageLimits } from "@/hooks/use-usage-limits"

const DesktopPanelContext = createContext<{
  open: boolean
  toggle: () => void
} | null>(null)

function useDesktopPanel() {
  const context = use(DesktopPanelContext)

  if (!context) {
    throw new Error("useDesktopPanel must be used within DesktopPanelProvider.")
  }

  return context
}

// Shares the open state between the toggle in the chat header and the panel
// beside the chat, which are composed apart from each other in the page.
function DesktopPanelProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <DesktopPanelContext value={{ open, toggle: () => setOpen((o) => !o) }}>
      {children}
    </DesktopPanelContext>
  )
}

function DesktopPanelToggle() {
  const { open, toggle } = useDesktopPanel()
  const requireFeatures = usePaidFeatures()
  const requireUsage = useUsageLimits()

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-pressed={open}
      onClick={async () => {
        // Connecting to a sandbox is paid and takes sandbox hours. Closing
        // the panel never does.
        if (
          open ||
          (requireFeatures("sandboxes") && (await requireUsage("sandbox")))
        ) {
          toggle()
        }
      }}
    >
      <MonitorIcon />
      <span className="sr-only">Toggle desktop</span>
    </Button>
  )
}

// Renders its children, the resize handle and panel, only while open.
function DesktopPanel({ children }: { children: React.ReactNode }) {
  const { open } = useDesktopPanel()

  return open ? children : null
}

export { DesktopPanel, DesktopPanelProvider, DesktopPanelToggle }
