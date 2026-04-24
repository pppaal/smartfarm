import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN;
let enabled = false;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
  enabled = true;
  console.log('[sentry] enabled');
} else {
  console.log('[sentry] disabled (SENTRY_DSN 미설정)');
}

export const sentryEnabled = () => enabled;
export { Sentry };
