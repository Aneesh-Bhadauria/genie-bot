import { Avatar, Style } from "@dicebear/core"
import gaze from "@dicebear/styles/gaze.json"
import Image from "next/image"

import { cn } from "@/lib/utils"

const style = new Style(gaze)

function ChatAvatar({
  seed,
  animated = false,
  className,
}: {
  seed: string
  animated?: boolean
  className?: string
}) {
  const src = new Avatar(style, {
    seed,
    animationVariant: [animated ? "medium" : "none"],
  }).toDataUri()

  return (
    <Image
      data-slot="chat-avatar"
      src={src}
      alt=""
      width={32}
      height={32}
      unoptimized
      className={cn("size-8 shrink-0", className)}
    />
  )
}

export { ChatAvatar }
