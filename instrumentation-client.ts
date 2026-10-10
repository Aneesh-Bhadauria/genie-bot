import * as Sentry from "@sentry/nextjs"

// Sentry in the browser. Loaded by Next.js before the app starts.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // every request while developing, a tenth of them in production
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // Session Replay: a tenth of all sessions, and every session with an error.
  // Text and inputs are masked by default, so chat content is not recorded.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [Sentry.replayIntegration()],
})

// lets Sentry trace App Router navigations
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
