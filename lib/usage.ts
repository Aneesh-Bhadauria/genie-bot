import { createClerkClient } from "@clerk/backend"
import type { LanguageModelUsage } from "ai"
import { and, count, eq, gte, sum } from "drizzle-orm"

import { db } from "@/db"
import { bots, usageLedger } from "@/db/schema"
import {
  PAID_PLAN,
  usageLimitMessages,
  usageLimits,
  type UsageKind,
} from "@/lib/billing"

// Used from both the Next.js server and Trigger.dev tasks, which have no
// request to read a session from, so this talks to Clerk by user id.
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

// Micro-dollars per token for claude-sonnet-5-5, the model in trigger/chat.ts:
// $2 per million input tokens and $10 per million output tokens, with cached
// input at $0.20 to read and $2.50 to write.
const AI_PRICES = { input: 2, cacheRead: 0.2, cacheWrite: 2.5, output: 10 }

// What a turn cost us, in micro-dollars.
export function getAiCost(usage: LanguageModelUsage) {
  const cacheRead = usage.inputTokenDetails?.cacheReadTokens ?? 0
  const cacheWrite = usage.inputTokenDetails?.cacheWriteTokens ?? 0
  const input =
    usage.inputTokenDetails?.noCacheTokens ??
    Math.max((usage.inputTokens ?? 0) - cacheRead - cacheWrite, 0)

  return Math.ceil(
    input * AI_PRICES.input +
      cacheRead * AI_PRICES.cacheRead +
      cacheWrite * AI_PRICES.cacheWrite +
      (usage.outputTokens ?? 0) * AI_PRICES.output
  )
}

type BillingPeriod = { start: Date; end: Date | null }

// A period only changes at renewal, so it is remembered for a few minutes.
// Having no paid plan is never remembered: an upgrade has to count at once.
const PERIOD_TTL_MS = 5 * 60 * 1000
const periods = new Map<string, { period: BillingPeriod; fetchedAt: number }>()

// The user's current billing period on the paid plan, or null without one.
async function getBillingPeriod(userId: string) {
  const cached = periods.get(userId)
  const now = Date.now()

  if (
    cached &&
    now - cached.fetchedAt < PERIOD_TTL_MS &&
    (!cached.period.end || cached.period.end.getTime() > now)
  ) {
    return cached.period
  }

  const subscription = await clerk.billing.getUserBillingSubscription(userId)
  // a cancelled plan stays active until the period it was paid for ends
  const item = subscription.subscriptionItems.find(
    (item) => item.plan?.slug === PAID_PLAN && item.status === "active"
  )

  if (!item) {
    periods.delete(userId)
    return null
  }

  const period = {
    start: new Date(item.periodStart),
    end: item.periodEnd ? new Date(item.periodEnd) : null,
  }
  periods.set(userId, { period, fetchedAt: now })

  return period
}

export type Usage = {
  period: BillingPeriod
  used: Record<UsageKind, number>
  limits: Record<UsageKind, number>
}

// Where the user stands in their current billing period, or null when they
// are not on the paid plan. The ledger has no balance column: what was used
// is the sum of the period's entries.
export async function getUsage(userId: string): Promise<Usage | null> {
  const period = await getBillingPeriod(userId)

  if (!period) {
    return null
  }

  const [entries, [{ value: botCount }]] = await Promise.all([
    db
      .select({ kind: usageLedger.kind, total: sum(usageLedger.amount) })
      .from(usageLedger)
      .where(
        and(
          eq(usageLedger.userId, userId),
          gte(usageLedger.createdAt, period.start)
        )
      )
      .groupBy(usageLedger.kind),
    db.select({ value: count() }).from(bots).where(eq(bots.userId, userId)),
  ])

  const used = { ai: 0, sandbox: 0, bots: botCount }

  for (const entry of entries) {
    used[entry.kind] = Number(entry.total ?? 0)
  }

  return { period, used, limits: usageLimits }
}

// The first of the given limits the user has reached, if any.
export function getExhausted(usage: Usage, ...kinds: UsageKind[]) {
  return kinds.find((kind) => usage.used[kind] >= usage.limits[kind]) ?? null
}

// For server-side work that must not start once a limit is reached. The
// message is safe to show to the user.
export async function assertUsage(userId: string, ...kinds: UsageKind[]) {
  const usage = await getUsage(userId)

  if (!usage) {
    throw new Error("This needs a paid plan.")
  }

  const exhausted = getExhausted(usage, ...kinds)

  if (exhausted) {
    throw new Error(usageLimitMessages[exhausted])
  }
}

// Adds an entry to the ledger. Entries are never changed or removed.
export async function recordUsage(entry: typeof usageLedger.$inferInsert) {
  if (entry.amount > 0) {
    await db.insert(usageLedger).values(entry)
  }
}
