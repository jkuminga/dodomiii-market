import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import session from 'express-session';
import pinoHttp from 'pino-http';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const sessionName = config.get<string>('SESSION_NAME', 'admin_session');
  const sessionSecret = config.get<string>('SESSION_SECRET', 'dev-session-secret');
  const sessionCookieSecure = config.get<string>('SESSION_COOKIE_SECURE', 'false') === 'true';
  const sessionCookieMaxAgeMs = Number(config.get<string>('SESSION_COOKIE_MAX_AGE_MS', '604800000'));

  if (sessionCookieSecure) {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  app.use(
    session({
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
    }),
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

  const port = config.get<number>('PORT', 4000);
  await app.listen(port);
}

bootstrap();
