import { schedules } from "@trigger.dev/sdk"
import { isNotNull } from "drizzle-orm"

import { db } from "@/db"
import { bots } from "@/db/schema"
import { daytona } from "@/lib/daytona"
import { getExhausted, getUsage, recordUsage } from "@/lib/usage"

const INTERVAL_SECONDS = 5 * 60

// Daytona bills these the same as a started sandbox
const RUNNING_STATES = ["started", "starting", "stopping", "creating"]

// Meters sandbox time. Nothing tells us when a sandbox stops, since Daytona
// stops idle ones by itself, so this looks every few minutes and charges each
// running sandbox for the time since the last look.
//
// It is also where the sandbox limit is enforced on sandboxes that are
// already running: once their owner is out of hours, or off the paid plan,
// they are stopped.
export const meterSandboxes = schedules.task({
  id: "meter-sandboxes",
  cron: "*/5 * * * *",
  // a retry would charge the same stretch of time twice
  retry: { maxAttempts: 1 },
  run: async ({ timestamp, lastTimestamp }) => {
    // capped, so a schedule that was paused does not bill for the pause
    const elapsed = lastTimestamp
      ? Math.min(
          Math.round((timestamp.getTime() - lastTimestamp.getTime()) / 1000),
          INTERVAL_SECONDS * 2
        )
      : INTERVAL_SECONDS

    const owners = new Map(
      (
        await db
          .select({
            id: bots.id,
            userId: bots.userId,
            sandboxId: bots.sandboxId,
          })
          .from(bots)
          .where(isNotNull(bots.sandboxId))
      ).map((bot) => [bot.sandboxId, bot])
    )

    // by owner, so each user's limit is checked once
    const running = new Map<string, Awaited<ReturnType<typeof daytona.get>>[]>()

    for await (const sandbox of daytona.list()) {
      const bot = owners.get(sandbox.id)

      if (!bot || !sandbox.state || !RUNNING_STATES.includes(sandbox.state)) {
        continue
      }

      await recordUsage({
        userId: bot.userId,
        kind: "sandbox",
        amount: elapsed,
        botId: bot.id,
      })
      running.set(bot.userId, [...(running.get(bot.userId) ?? []), sandbox])
    }

    let stopped = 0

    for (const [userId, sandboxes] of running) {
      const usage = await getUsage(userId)

      if (usage && !getExhausted(usage, "sandbox")) {
        continue
      }

      for (const sandbox of sandboxes) {
        // one that is already on its way down needs no help
        if (sandbox.state === "started") {
          await sandbox.stop()
          stopped++
        }
      }
    }

    return { running: [...running.values()].flat().length, stopped }
  },
})
