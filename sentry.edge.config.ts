import * as Sentry from "@sentry/nextjs"

// Sentry on the edge runtime, for any route that runs there. Loaded from
// instrumentation.ts.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // every request while developing, a tenth of them in production
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
})
