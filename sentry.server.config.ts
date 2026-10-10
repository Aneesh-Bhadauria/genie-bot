import * as Sentry from "@sentry/nextjs"

// Sentry on the Node.js server: server components, server actions and route
// handlers. Loaded from instrumentation.ts.
//
// Local variables and request bodies are deliberately not attached: here they
// would carry chat messages and sandbox desktop links.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // every request while developing, a tenth of them in production
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
})
