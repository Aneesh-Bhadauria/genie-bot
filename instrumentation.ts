import * as Sentry from "@sentry/nextjs"

// Runs once when a server instance starts; each runtime gets its own Sentry.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config")
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }
}

// reports errors thrown while rendering or handling a request on the server
export const onRequestError = Sentry.captureRequestError
