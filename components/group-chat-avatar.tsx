import { ChatAvatar } from "@/components/chat-avatar"
import { cn } from "@/lib/utils"

// where each face sits inside the square, by how many there are
const layouts: Record<number, string[]> = {
  // side by side, overlapping in the middle
  2: [
    "top-1/2 left-0 size-[62%] -translate-y-1/2",
    "top-1/2 right-0 size-[62%] -translate-y-1/2",
  ],
  // a triangle: one on top, two below
  3: [
    "top-0 left-1/2 size-[54%] -translate-x-1/2",
    "bottom-0 left-0 size-[54%]",
    "right-0 bottom-0 size-[54%]",
  ],
  // a 2x2 grid
  4: [
    "top-0 left-0 size-1/2",
    "top-0 right-0 size-1/2",
    "bottom-0 left-0 size-1/2",
    "right-0 bottom-0 size-1/2",
  ],
}

// The face of a chat: its one bot, or its bots arranged inside a square the
// same size as a single ChatAvatar, so both take up the same room.
//
// Up to four bots are all shown. Beyond that the first three are, and the
// fourth cell counts the rest.
function GroupChatAvatar({
  seeds,
  className,
}: {
  seeds: string[]
  className?: string
}) {
  if (seeds.length <= 1) {
    return <ChatAvatar seed={seeds[0] ?? ""} className={className} />
  }

  const visible = seeds.length > 4 ? seeds.slice(0, 3) : seeds
  const hidden = seeds.length - visible.length
  const layout = layouts[visible.length + (hidden > 0 ? 1 : 0)]

  return (
    <div
      data-slot="group-chat-avatar"
      className={cn("@container relative size-8 shrink-0", className)}
    >
      {visible.map((seed, index) => (
        <ChatAvatar
          key={`${seed}-${index}`}
          seed={seed}
          className={cn("absolute", layout[index])}
        />
      ))}
      {hidden > 0 && (
        <span
          className={cn(
            // sized from the square, so the count scales with the avatar
            "absolute flex items-center justify-center rounded-full bg-muted text-[30cqw] leading-none font-medium text-muted-foreground",
            layout[3]
          )}
        >
          +{hidden}
        </span>
      )}
    </div>
  )
}

export { GroupChatAvatar }
