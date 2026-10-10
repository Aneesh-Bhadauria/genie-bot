import { PricingTable } from "@clerk/nextjs"

// Reached from the "View plans" action on the paid-plan toast; deliberately
// not linked from the sidebar.
export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6 py-12">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="font-heading text-2xl font-medium">Choose a plan</h1>
        <p className="text-sm text-muted-foreground">
          A paid plan unlocks bots, chatting with them and their sandboxes.
        </p>
      </div>
      <PricingTable newSubscriptionRedirectUrl="/" />
    </div>
  )
}
