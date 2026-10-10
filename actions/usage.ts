"use server"

import { auth } from "@clerk/nextjs/server"

import type { UsageKind } from "@/lib/billing"
import { getExhausted, getUsage } from "@/lib/usage"

// Asked by the browser before an action that uses the plan up, so it can
// explain a reached limit instead of failing. Returns the first of the given
// limits that is reached, if any. Without a paid plan nothing is reached:
// that case is the plan check's to explain.
export async function checkUsage(
  ...kinds: UsageKind[]
): Promise<UsageKind | null> {
  const { isAuthenticated, userId } = await auth()

  if (!isAuthenticated) {
    throw new Error("You must be signed in to check your usage.")
  }

  const usage = await getUsage(userId)

  return usage ? getExhausted(usage, ...kinds) : null
}
