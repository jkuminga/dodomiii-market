import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('does not require production values outside production', () => {
    expect(validateEnv({ NODE_ENV: 'development' })).toEqual({ NODE_ENV: 'development' });
  });

  it('rejects unsafe production defaults', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        SESSION_SECRET: 'dev-session-secret',
        CORS_ORIGIN: 'http://localhost:5173',
        SESSION_COOKIE_SECURE: 'false',
        SESSION_REDIS_ENABLED: 'false',
        ADMIN_LOGIN_RATE_LIMIT_REDIS_ENABLED: 'false',
      }),
    ).toThrow(/Invalid production environment/);
  });

  it('accepts production env when required deployment values are present and notifications are disabled', () => {
    const env = createValidProductionEnv({
      NOTIFICATIONS_ENABLED: 'false',
    });

    expect(validateEnv(env)).toBe(env);
  });

  it('accepts production env when SMS notifications are enabled with SOLAPI credentials and SMTP is empty', () => {
    const env = createValidProductionEnv({
      NOTIFICATIONS_ENABLED: 'true',
      NOTIFICATIONS_DRY_RUN: 'false',
      SOLAPI_API_KEY: 'solapi-key',
      SOLAPI_API_SECRET: 'solapi-secret',
      SOLAPI_SENDER: '01012345678',
      SMTP_HOST: '',
      SMTP_FROM_EMAIL: '',
    });

    expect(validateEnv(env)).toBe(env);
  });

  it('requires a notification provider only when notifications are enabled outside dry-run mode', () => {
    expect(() =>
      validateEnv(
        createValidProductionEnv({
          NOTIFICATIONS_ENABLED: 'true',
          NOTIFICATIONS_DRY_RUN: 'false',
        }),
      ),
    ).toThrow(/NOTIFICATIONS_ENABLED=true/);

    expect(
      validateEnv(
        createValidProductionEnv({
          NOTIFICATIONS_ENABLED: 'true',
          NOTIFICATIONS_DRY_RUN: 'true',
        }),
      ),
    ).toMatchObject({
      NOTIFICATIONS_ENABLED: 'true',
      NOTIFICATIONS_DRY_RUN: 'true',
    });
  });

  function createValidProductionEnv(overrides: Record<string, string> = {}) {
    return {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:pass@example.com:5432/postgres',
      SESSION_SECRET: 'replace-with-a-very-long-production-secret',
      SESSION_COOKIE_SECURE: 'true',
      CORS_ORIGIN: 'https://dodomi.example',
      REDIS_URL: 'rediss://default:password@example.com:6379',
      SESSION_REDIS_ENABLED: 'true',
      ADMIN_LOGIN_RATE_LIMIT_REDIS_ENABLED: 'true',
      STORE_WEB_BASE_URL: 'https://dodomi.example',
      ADMIN_WEB_BASE_URL: 'https://admin.dodomi.example',
      CLOUDINARY_CLOUD_NAME: 'cloud',
      CLOUDINARY_API_KEY: 'api-key',
      CLOUDINARY_API_SECRET: 'api-secret',
      ...overrides,
    };
  }
});
