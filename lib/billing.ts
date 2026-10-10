// The features of the paid plan, as set up in Clerk (Billing > Plans > Pro).
// A free account has neither.
//
// bots: creating bots and group chats, and chatting with them
// sandboxes: the computer each bot gets, and connecting to its desktop
export type BillingFeature = "bots" | "sandboxes"

export const PAID_PLAN = "pro"
export const PRICING_PATH = "/pricing"
export const USAGE_PATH = "/usage"

// `has` from Clerk's `auth()` on the server or `useAuth()` in the browser
type Has = (params: { feature: BillingFeature }) => boolean

export function hasFeatures(has: Has, ...features: BillingFeature[]) {
  return features.every((feature) => has({ feature }))
}

// For server actions. The browser checks first and explains with a toast, so
// this only stops requests that skipped that check.
export function assertFeatures(has: Has, ...features: BillingFeature[]) {
  if (!hasFeatures(has, ...features)) {
    throw new Error("This needs a paid plan.")
  }
}

// What the paid plan meters. `ai` and `sandbox` are consumed and start again
// with each billing period; `bots` is how many exist at once.
export type UsageKind = "ai" | "sandbox" | "bots"

// What one billing period of the paid plan includes. The two metered limits
// are sized against what they cost us, to stay well inside the plan's price:
// at most $8 of model usage and about $2.70 of sandbox time (40 hours of a
// 1 vCPU, 1 GiB sandbox at Daytona's $0.0666 an hour).
export const usageLimits: Record<UsageKind, number> = {
  // micro-dollars of model cost
  ai: 8_000_000,
  // seconds of running sandboxes
  sandbox: 40 * 60 * 60,
  // each bot keeps a sandbox, and a stopped one still holds its disk
  bots: 5,
}

export const usageLimitMessages: Record<UsageKind, string> = {
  ai: "You have used all the AI usage in your plan for this billing period.",
  sandbox:
    "You have used all the sandbox hours in your plan for this billing period.",
  bots: "You have reached the number of bots in your plan. Delete one to create another.",
}
