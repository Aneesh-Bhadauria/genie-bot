"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "cn"
import { MonitorOffIcon, XIcon } from "lucide-react"

import { getDesktopUrl } from "@/actions/chat"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"

type Desktop = Awaited<ReturnType<typeof getDesktopUrl>>

// The sandbox's live desktop: a preview that fills its container, and a
// fullscreen dialog on click.
//
// Both show the same iframe. Moving an iframe in the DOM reloads it, so it
// never moves: it stays here and is only restyled, from filling this
// container to floating over the dialog's empty body.
function DesktopView({ chatId }: { chatId: string }) {
  const [desktop, setDesktop] = useState<Desktop | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const frameRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    let ignore = false

    getDesktopUrl(chatId)
      .catch(() => ({ error: "The desktop could not be started." }))
      .then((result) => {
        if (!ignore) {
          setDesktop(result)
        }
      })

    return () => {
      ignore = true
    }
  }, [chatId, attempt])

  if (!desktop) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Spinner />
          </EmptyMedia>
          <EmptyTitle>Starting the desktop</EmptyTitle>
          <EmptyDescription>
            This can take a moment when the sandbox has been idle.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if ("error" in desktop) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MonitorOffIcon />
          </EmptyMedia>
          <EmptyTitle>No desktop</EmptyTitle>
          <EmptyDescription>{desktop.error}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDesktop(null)
              setAttempt((current) => current + 1)
            }}
          >
            Try again
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <div className="relative size-full bg-muted">
      <div
        className={cn(
          "overflow-hidden bg-black",
          fullscreen
            ? // over the dialog's body: its 1rem inset plus its 3rem header
              "fixed inset-x-4 top-16 bottom-4 z-60 rounded-b-xl"
            : "absolute inset-0"
        )}
      >
        <iframe
          ref={frameRef}
          src={desktop.url}
          title="Sandbox desktop"
          allow="clipboard-read; clipboard-write"
          className="size-full border-0"
        />
        {/* the preview is look-only: a click anywhere opens it fullscreen */}
        {!fullscreen && (
          <button
            type="button"
            className="absolute inset-0 cursor-zoom-in"
            onClick={() => setFullscreen(true)}
          >
            <span className="sr-only">Open the desktop in fullscreen</span>
          </button>
        )}
      </div>
      {/* Not modal, so focus can sit in the iframe, which lives outside the
          popup. Nothing but the close button closes it: Escape and outside
          presses are meant for the desktop, not the dialog. */}
      <Dialog
        open={fullscreen}
        modal={false}
        disablePointerDismissal
        onOpenChange={(open) => {
          if (open) {
            setFullscreen(true)
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          initialFocus={frameRef}
          className="top-4 left-4 flex h-[calc(100svh-2rem)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 p-0 data-closed:animate-none data-open:animate-none sm:max-w-none"
        >
          <DialogHeader className="h-12 shrink-0 flex-row items-center justify-between px-4">
            <DialogTitle>Desktop</DialogTitle>
            <Button
              variant="ghost"
              size="icon-sm"
              className="-mr-2"
              onClick={() => setFullscreen(false)}
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </Button>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export { DesktopView }
