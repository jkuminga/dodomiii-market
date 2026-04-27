import 'reflect-metadata';

import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { RedisStore } from 'connect-redis';
import type { Express, Request, Response } from 'express';
import session, { type SessionOptions } from 'express-session';
import pinoHttp from 'pino-http';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RedisService } from './common/redis/redis.service';

function flattenValidationErrors(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => {
    const messages = error.constraints ? Object.values(error.constraints) : [];
    const childMessages = error.children?.length ? flattenValidationErrors(error.children) : [];

    return [...messages, ...childMessages];
  });
}

function parseTrustProxy(value: string): boolean | number | string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed === 'true') {
    return true;
  }

  if (trimmed === 'false') {
    return false;
  }

  const numericValue = Number(trimmed);
  if (Number.isInteger(numericValue) && numericValue >= 0) {
    return numericValue;
  }

  return trimmed;
}

async function createApp() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const redisService = app.get(RedisService);

  const sessionName = config.get<string>('SESSION_NAME', 'admin_session');
  const sessionSecret = config.get<string>('SESSION_SECRET', 'dev-session-secret');
  const sessionCookieSecure = config.get<string>('SESSION_COOKIE_SECURE', 'false') === 'true';
  const sessionCookieMaxAgeMs = Number(config.get<string>('SESSION_COOKIE_MAX_AGE_MS', '604800000'));
  const sessionRedisEnabled = config.get<boolean>('SESSION_REDIS_ENABLED', false);
  const adminLoginRateLimitRedisEnabled = config.get<boolean>(
    'ADMIN_LOGIN_RATE_LIMIT_REDIS_ENABLED',
    false,
  );

  if (sessionRedisEnabled || adminLoginRateLimitRedisEnabled) {
    app.enableShutdownHooks();
  }

  const configuredTrustProxy = parseTrustProxy(config.get<string>('TRUST_PROXY', ''));
  const trustProxy = configuredTrustProxy ?? (sessionCookieSecure ? 1 : undefined);
  if (trustProxy !== undefined) {
    app.getHttpAdapter().getInstance().set('trust proxy', trustProxy);
  }

  const sessionOptions: SessionOptions = {
    name: sessionName,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: sessionCookieSecure,
      sameSite: 'lax',
      maxAge: sessionCookieMaxAgeMs,
    },
  };

  if (sessionRedisEnabled) {
    const redisClient = await redisService.getClient();

    sessionOptions.store = new RedisStore({
      client: redisClient,
      prefix: redisService.buildKey(`${sessionName}:`),
      ttl: Math.ceil(sessionCookieMaxAgeMs / 1000),
    });
  }

  app.use(
    session(sessionOptions),
  );

  app.use(
    pinoHttp({
      level: config.get<string>('LOG_LEVEL', 'info'),
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: flattenValidationErrors(errors).join(', ') || '요청값이 올바르지 않습니다.',
        }),
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const apiPrefix = config.get<string>('API_PREFIX', 'api/v1');
  app.setGlobalPrefix(apiPrefix);

  const corsOrigin = config.get<string>('CORS_ORIGIN', 'http://localhost:5173');
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  return app;
}

async function bootstrap() {
  const app = await createApp();
  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 4000);
  await app.listen(port);
}

let cachedServer: Express | null = null;

async function getServer(): Promise<Express> {
  if (cachedServer) {
    return cachedServer;
  }

  const app = await createApp();
  await app.init();

  cachedServer = app.getHttpAdapter().getInstance() as Express;
  return cachedServer;
}

export default async function handler(request: Request, response: Response) {
  const server = await getServer();
  return server(request, response);
}

if (require.main === module) {
  void bootstrap();
}
