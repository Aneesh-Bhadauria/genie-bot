import { withSentryConfig } from "@sentry/nextjs/config"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {}

export default withSentryConfig(nextConfig, {
  org: "genie-26",
  project: "genie-bot",

  // Uploads source maps on production builds, so stack traces show this code
  // instead of minified output. Without the token the upload is skipped.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,

  // sends browser events through the app's own domain, past ad blockers
  tunnelRoute: "/monitoring",

  silent: !process.env.CI,
})
