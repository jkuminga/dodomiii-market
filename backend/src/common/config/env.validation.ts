type EnvRecord = Record<string, string | undefined>;

const localOriginPatterns = [
  /^https?:\/\/localhost(?::\d+)?$/i,
  /^https?:\/\/127\.0\.0\.1(?::\d+)?$/i,
  /^https?:\/\/\[::1\](?::\d+)?$/i,
];

export function validateEnv(config: EnvRecord): EnvRecord {
  if (config.NODE_ENV !== 'production') {
    return config;
  }

  const errors: string[] = [];
  const requiredKeys = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'CORS_ORIGIN',
    'REDIS_URL',
    'STORE_WEB_BASE_URL',
    'ADMIN_WEB_BASE_URL',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
  ];

  for (const key of requiredKeys) {
    requireNonEmpty(config, key, errors);
  }

  requireBoolean(config, 'SESSION_REDIS_ENABLED', true, errors);
  requireBoolean(config, 'ADMIN_LOGIN_RATE_LIMIT_REDIS_ENABLED', true, errors);
  requireBoolean(config, 'SESSION_COOKIE_SECURE', true, errors);
  requireSafeSessionSecret(config.SESSION_SECRET, errors);
  requirePublicOrigin(config.CORS_ORIGIN, 'CORS_ORIGIN', errors);
  requirePublicOrigin(config.STORE_WEB_BASE_URL, 'STORE_WEB_BASE_URL', errors);
  requirePublicOrigin(config.ADMIN_WEB_BASE_URL, 'ADMIN_WEB_BASE_URL', errors);

  if (isEnabled(config.NOTIFICATIONS_ENABLED, false) && !isEnabled(config.NOTIFICATIONS_DRY_RUN, false)) {
    requireNotificationProvider(config, errors);
  }

  if (errors.length > 0) {
    throw new Error(`Invalid production environment:\n${errors.map((error) => `- ${error}`).join('\n')}`);
  }

  return config;
}

function requireNonEmpty(config: EnvRecord, key: string, errors: string[]): void {
  if (!config[key]?.trim()) {
    errors.push(`${key} is required.`);
  }
}

function requireBoolean(config: EnvRecord, key: string, expected: boolean, errors: string[]): void {
  if (config[key]?.toLowerCase() !== String(expected)) {
    errors.push(`${key} must be ${expected}.`);
  }
}

function requireSafeSessionSecret(value: string | undefined, errors: string[]): void {
  const secret = value?.trim() ?? '';
  if (secret === 'dev-session-secret') {
    errors.push('SESSION_SECRET must not use the development default.');
  }
  if (secret.length < 32) {
    errors.push('SESSION_SECRET must be at least 32 characters long.');
  }
}

function requirePublicOrigin(value: string | undefined, key: string, errors: string[]): void {
  const origin = value?.trim() ?? '';
  if (!origin) {
    return;
  }

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    errors.push(`${key} must be a valid absolute URL.`);
    return;
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    errors.push(`${key} must use http or https.`);
  }

  if (localOriginPatterns.some((pattern) => pattern.test(origin))) {
    errors.push(`${key} must not point to localhost in production.`);
  }
}

function requireNotificationProvider(config: EnvRecord, errors: string[]): void {
  const hasSmtp = Boolean(config.SMTP_HOST?.trim() && config.SMTP_FROM_EMAIL?.trim());
  const hasSolapi = Boolean(
    config.SOLAPI_API_KEY?.trim() && config.SOLAPI_API_SECRET?.trim() && config.SOLAPI_SENDER?.trim(),
  );

  if (!hasSmtp && !hasSolapi) {
    errors.push(
      'NOTIFICATIONS_ENABLED=true requires SMTP_* or SOLAPI_* credentials unless NOTIFICATIONS_DRY_RUN=true.',
    );
  }
}

function isEnabled(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  return value.toLowerCase() === 'true';
}
