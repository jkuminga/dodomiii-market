export default () => ({
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT ?? 4000),
  API_PREFIX: process.env.API_PREFIX ?? 'api/v1',
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
});
