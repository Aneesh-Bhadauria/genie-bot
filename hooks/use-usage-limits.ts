"use client"

import { useRouter } from "next/navigation"

import { checkUsage } from "@/actions/usage"
import { toast } from "@/components/ui/toast"
import { USAGE_PATH, usageLimitMessages, type UsageKind } from "@/lib/billing"

// Returns a check to await before an action that uses the plan up: true when
// none of the given limits is reached, otherwise false after an error toast
// that links to the usage page.
function useUsageLimits() {
  const router = useRouter()

  return async function requireUsage(...kinds: UsageKind[]) {
    let exhausted: UsageKind | null

    try {
      exhausted = await checkUsage(...kinds)
    } catch {
      // could not ask: let it through, the server checks again
      return true
    }

    if (!exhausted) {
      return true
    }

    toast.add({
      type: "error",
      title: "You have reached a limit of your plan",
      description: usageLimitMessages[exhausted],
      actionProps: {
        children: "View usage",
        onClick: () => router.push(USAGE_PATH),
      },
    })

    return false
  }
}

export { useUsageLimits }
