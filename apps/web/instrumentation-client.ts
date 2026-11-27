import * as Sentry from "@sentry/nextjs";

// Browser errors and tracing for hrneck-web. Session Replay is intentionally not
// enabled: the app shows employee and HR data. Empty DSN disables sending.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0),
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
