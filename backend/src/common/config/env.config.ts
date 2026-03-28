export default () => ({
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT ?? 4000),
  API_PREFIX: process.env.API_PREFIX ?? 'api/v1',
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  SESSION_NAME: process.env.SESSION_NAME ?? 'admin_session',
  SESSION_SECRET: process.env.SESSION_SECRET ?? 'dev-session-secret',
  SESSION_COOKIE_SECURE: process.env.SESSION_COOKIE_SECURE ?? 'false',
  SESSION_COOKIE_MAX_AGE_MS: process.env.SESSION_COOKIE_MAX_AGE_MS ?? '604800000',
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
});
