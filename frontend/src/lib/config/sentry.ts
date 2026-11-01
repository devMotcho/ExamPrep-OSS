/**
 * Optional error reporting. Without VITE_SENTRY_DSN the SDK is never downloaded:
 * the dynamic import below is the only reference to it.
 */
let sentry: Promise<typeof import('@sentry/react')> | null = null;

export const initSentry = (): void => {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;

  sentry = import('@sentry/react');
  sentry
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        sendDefaultPii: false,
      });
    })
    .catch(() => {
      // Error reporting must never break the app, e.g. when an ad blocker stops the chunk.
    });
};

/** For error boundaries, which swallow errors before the global handlers see them. */
export const captureException = (error: unknown): void => {
  sentry?.then((Sentry) => Sentry.captureException(error)).catch(() => {});
};
