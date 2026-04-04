const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }

  return value.toLowerCase() === 'true';
};

export default () => ({
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT ?? 4000),
  API_PREFIX: process.env.API_PREFIX ?? 'api/v1',
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  SESSION_NAME: process.env.SESSION_NAME ?? 'admin_session',
  SESSION_SECRET: process.env.SESSION_SECRET ?? 'dev-session-secret',
  SESSION_COOKIE_SECURE: process.env.SESSION_COOKIE_SECURE ?? 'false',
  SESSION_COOKIE_MAX_AGE_MS: process.env.SESSION_COOKIE_MAX_AGE_MS ?? '604800000',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ?? '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ?? '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ?? '',
  CLOUDINARY_UPLOAD_FOLDER: process.env.CLOUDINARY_UPLOAD_FOLDER ?? 'dodomi',
  ORDER_SHIPPING_FEE: Number(process.env.ORDER_SHIPPING_FEE ?? 3000),
  ORDER_DEPOSIT_BANK_NAME: process.env.ORDER_DEPOSIT_BANK_NAME ?? '국민은행',
  ORDER_DEPOSIT_ACCOUNT_HOLDER: process.env.ORDER_DEPOSIT_ACCOUNT_HOLDER ?? '도도미마켓',
  ORDER_DEPOSIT_ACCOUNT_NUMBER: process.env.ORDER_DEPOSIT_ACCOUNT_NUMBER ?? '000-00-000000',
  ORDER_DEPOSIT_DEADLINE_DAYS: Number(process.env.ORDER_DEPOSIT_DEADLINE_DAYS ?? 1),
  CUSTOM_CHECKOUT_BASE_URL:
    process.env.CUSTOM_CHECKOUT_BASE_URL ?? 'http://localhost:5173/custom-checkout',
  NOTIFICATIONS_ENABLED: parseBoolean(process.env.NOTIFICATIONS_ENABLED, true),
  NOTIFICATIONS_DRY_RUN: parseBoolean(process.env.NOTIFICATIONS_DRY_RUN, false),
  NOTIFICATIONS_ADMIN_STATUS_SUMMARY_ENABLED: parseBoolean(
    process.env.NOTIFICATIONS_ADMIN_STATUS_SUMMARY_ENABLED,
    true,
  ),
  NOTIFICATIONS_RETRY_ATTEMPTS: Number(process.env.NOTIFICATIONS_RETRY_ATTEMPTS ?? 3),
  NOTIFICATIONS_RETRY_BASE_DELAY_MS: Number(
    process.env.NOTIFICATIONS_RETRY_BASE_DELAY_MS ?? 1000,
  ),
  SMTP_HOST: process.env.SMTP_HOST ?? '',
  SMTP_PORT: Number(process.env.SMTP_PORT ?? 587),
  SMTP_SECURE: parseBoolean(process.env.SMTP_SECURE, false),
  SMTP_USER: process.env.SMTP_USER ?? '',
  SMTP_PASS: process.env.SMTP_PASS ?? '',
  SMTP_FROM_NAME: process.env.SMTP_FROM_NAME ?? 'Dodomi',
  SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL ?? '',
  SMTP_CONNECTION_TIMEOUT_MS: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS ?? 10000),
  SOLAPI_API_KEY: process.env.SOLAPI_API_KEY ?? '',
  SOLAPI_API_SECRET: process.env.SOLAPI_API_SECRET ?? '',
  SOLAPI_SENDER: process.env.SOLAPI_SENDER ?? '',
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
});
