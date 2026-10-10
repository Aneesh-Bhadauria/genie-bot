"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"
import NextError from "next/error"

// Replaces the root layout when it, or anything no other boundary caught,
// throws while rendering. Reports the error and shows Next.js's error page.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    // global-error must bring its own html and body
    <html lang="en">
      <body>
        {/* the App Router gives no status code, so 0 shows a generic message */}
        <NextError statusCode={0} />
      </body>
    </html>
  )
}
