export default () => ({
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT ?? 4000),
  API_PREFIX: process.env.API_PREFIX ?? 'api/v1',
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  SESSION_NAME: process.env.SESSION_NAME ?? 'admin_session',
  SESSION_SECRET: process.env.SESSION_SECRET ?? 'dev-session-secret',
  SESSION_COOKIE_SECURE: process.env.SESSION_COOKIE_SECURE ?? 'false',
  SESSION_COOKIE_MAX_AGE_MS: process.env.SESSION_COOKIE_MAX_AGE_MS ?? '604800000',
  ORDER_SHIPPING_FEE: Number(process.env.ORDER_SHIPPING_FEE ?? 3000),
  ORDER_DEPOSIT_BANK_NAME: process.env.ORDER_DEPOSIT_BANK_NAME ?? '국민은행',
  ORDER_DEPOSIT_ACCOUNT_HOLDER: process.env.ORDER_DEPOSIT_ACCOUNT_HOLDER ?? '도도미마켓',
  ORDER_DEPOSIT_ACCOUNT_NUMBER: process.env.ORDER_DEPOSIT_ACCOUNT_NUMBER ?? '000-00-000000',
  ORDER_DEPOSIT_DEADLINE_DAYS: Number(process.env.ORDER_DEPOSIT_DEADLINE_DAYS ?? 1),
  CUSTOM_CHECKOUT_BASE_URL:
    process.env.CUSTOM_CHECKOUT_BASE_URL ?? 'http://localhost:5173/custom-checkout',
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
});
