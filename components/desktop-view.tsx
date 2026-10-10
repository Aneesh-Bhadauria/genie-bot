"use client"

import { useEffect, useRef, useState } from "react"
import type RFB from "@novnc/novnc"
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

const FAILED = "The desktop could not be started."
const DISCONNECTED = "The connection to the desktop was lost."

// The sandbox's live desktop: a look-only preview that fills its container,
// and a fullscreen dialog on click that takes mouse and keyboard.
//
// Both show the same VNC connection. Its screen never moves in the DOM, which
// would mean reconnecting: it stays here and is only restyled, from filling
// this container to floating over the dialog's empty body.
function DesktopView({ chatId }: { chatId: string }) {
  const [status, setStatus] = useState<"connecting" | "connected">("connecting")
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const screenRef = useRef<HTMLDivElement>(null)
  const rfbRef = useRef<RFB | null>(null)

  useEffect(() => {
    let ignore = false
    let rfb: RFB | undefined

    async function connect() {
      // noVNC reads browser globals on import, so it cannot load on the server
      const [desktop, { default: Client }] = await Promise.all([
        getDesktopUrl(chatId),
        import("@novnc/novnc"),
      ])

      if (ignore || !screenRef.current) {
        return
      }

      if ("error" in desktop) {
        setError(desktop.error)
        return
      }

      rfb = new Client(screenRef.current, desktop.url)
      // fit the desktop to the screen element, whatever size that has
      rfb.scaleViewport = true
      rfb.background = "black"
      // the preview is look-only until it is opened fullscreen
      rfb.viewOnly = true
      rfb.addEventListener("connect", () => setStatus("connected"))
      rfb.addEventListener("disconnect", () => {
        // not our own disconnect below, so the desktop went away
        if (!ignore) {
          rfbRef.current = null
          setFullscreen(false)
          setError(DISCONNECTED)
        }
      })
      rfbRef.current = rfb
    }

    connect().catch(() => {
      if (!ignore) {
        setError(FAILED)
      }
    })

    return () => {
      ignore = true
      rfbRef.current = null
      rfb?.disconnect()
    }
  }, [chatId, attempt])

  // only the fullscreen desktop accepts input
  useEffect(() => {
    const rfb = rfbRef.current

    if (!rfb) {
      return
    }

    rfb.viewOnly = !fullscreen

    if (fullscreen) {
      rfb.focus()
    }
  }, [fullscreen])

  function retry() {
    setError(null)
    setStatus("connecting")
    setAttempt((current) => current + 1)
  }

  return (
    <div className="relative size-full bg-muted">
      {error ? (
        <Empty className="h-full">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MonitorOffIcon />
            </EmptyMedia>
            <EmptyTitle>No desktop</EmptyTitle>
            <EmptyDescription>{error}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="sm" onClick={retry}>
              Try again
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        status === "connecting" && (
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
      )}
      <div
        className={cn(
          "overflow-hidden bg-black",
          fullscreen
            ? // over the dialog's body: its 1rem inset plus its 3rem header
              "fixed inset-x-4 top-16 bottom-4 z-60 rounded-b-xl"
            : "absolute inset-0",
          // mounted throughout so the VNC client always has its element
          (error || status === "connecting") && "invisible"
        )}
      >
        <div ref={screenRef} className="size-full" />
        {/* a click anywhere on the preview opens it fullscreen */}
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
      {/* Not modal, so focus can sit in the desktop, which lives outside the
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
          // focus goes to the desktop instead, once it accepts input
          initialFocus={false}
          className="top-4 left-4 flex h-[calc(100svh-2rem)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 p-0 sm:max-w-none data-open:animate-none data-closed:animate-none"
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
