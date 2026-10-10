"use client"

import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"

import { toast } from "@/components/ui/toast"
import { hasFeatures, PRICING_PATH, type BillingFeature } from "@/lib/billing"

// Returns a check to run before a paid action: true when the signed-in user's
// plan has every feature, otherwise false after an error toast that links to
// the pricing page.
function usePaidFeatures() {
  const { isLoaded, has } = useAuth()
  const router = useRouter()

  return function requireFeatures(...features: BillingFeature[]) {
    // not known yet: let it through, the server action checks again
    if (!isLoaded || !has || hasFeatures(has, ...features)) {
      return true
    }

    toast.add({
      type: "error",
      title: "This needs a paid plan",
      description: "Upgrade to create bots, chat with them and use sandboxes.",
      actionProps: {
        children: "View plans",
        onClick: () => router.push(PRICING_PATH),
      },
    })

    return false
  }
}

export { usePaidFeatures }
