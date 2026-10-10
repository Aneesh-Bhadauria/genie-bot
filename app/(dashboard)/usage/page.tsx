import { auth } from "@clerk/nextjs/server"
import { format } from "date-fns"
import { GaugeIcon } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress"
import { PRICING_PATH, type UsageKind } from "@/lib/billing"
import { getUsage, type Usage } from "@/lib/usage"

const meters: {
  kind: UsageKind
  label: string
  // the amounts behind the bar, in words
  describe: (used: number, limit: number) => string
}[] = [
  {
    kind: "ai",
    label: "AI usage",
    // the amounts are what the model cost us, which means little to a user
    describe: () => "What your bots have read and written in their chats.",
  },
  {
    kind: "sandbox",
    label: "Sandbox hours",
    describe: (used, limit) =>
      `${(used / 3600).toFixed(1)} of ${limit / 3600} hours with a sandbox running.`,
  },
  {
    kind: "bots",
    label: "Bots",
    describe: (used, limit) =>
      `${used} of ${limit} bots. This one does not reset: delete a bot to free a place.`,
  },
]

function UsageMeter({
  usage,
  meter,
}: {
  usage: Usage
  meter: (typeof meters)[number]
}) {
  const used = usage.used[meter.kind]
  const limit = usage.limits[meter.kind]

  return (
    <div className="flex flex-col gap-2">
      {/* a bar cannot go past full, though usage can run a little over */}
      <Progress value={Math.min((used / limit) * 100, 100)}>
        <ProgressLabel>{meter.label}</ProgressLabel>
        <ProgressValue />
      </Progress>
      <p className="text-sm text-muted-foreground">
        {meter.describe(used, limit)}
      </p>
    </div>
  )
}

// Reached from the user button in the sidebar footer, and from the toast
// shown when a limit is reached.
export default async function Page() {
  const { userId } = await auth.protect()
  const usage = await getUsage(userId)

  if (!usage) {
    return (
      <Empty className="h-svh">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <GaugeIcon />
          </EmptyMedia>
          <EmptyTitle>No usage to show</EmptyTitle>
          <EmptyDescription>
            Usage is tracked on the paid plan, which unlocks bots and their
            sandboxes.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button render={<Link href={PRICING_PATH} />}>View plans</Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-6 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-medium">Usage</h1>
        <p className="text-sm text-muted-foreground">
          What you have used of your plan in the current billing period.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>This billing period</CardTitle>
          <CardDescription>
            Since {format(usage.period.start, "d MMMM yyyy")}
            {usage.period.end &&
              `. AI usage and sandbox hours start again on ${format(usage.period.end, "d MMMM yyyy")}`}
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {meters.map((meter) => (
            <UsageMeter key={meter.kind} usage={usage} meter={meter} />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
