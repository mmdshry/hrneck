import * as Sentry from "@sentry/nextjs";

// Server and edge error reporting for hrneck-web. The same DSN/env values as the
// browser SDK; NEXT_PUBLIC_* values are inlined at build time for server bundles too.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
      tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0),
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
