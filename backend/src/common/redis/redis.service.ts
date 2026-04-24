import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

type RedisClient = ReturnType<typeof createClient>;

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: RedisClient;
  private connectPromise: Promise<void> | null = null;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.getRedisUrl();
    this.client = createClient(redisUrl ? { url: redisUrl } : undefined);

    this.client.on('error', (error) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Redis client error: ${message}`);
    });
  }

  async onModuleInit(): Promise<void> {
    if (this.shouldConnectOnBoot()) {
      await this.connect();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client.isOpen) {
      return;
    }

    await this.client.quit();
  }

  isConfigured(): boolean {
    return this.getRedisUrl().length > 0;
  }

  buildKey(suffix: string): string {
    const prefix = this.configService.get<string>('REDIS_KEY_PREFIX', 'dodomi:');
    return `${prefix}${suffix}`;
  }

  async getClient(): Promise<RedisClient> {
    await this.connect();
    return this.client;
  }

  private async connect(): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Redis requires REDIS_URL.');
    }

    if (this.client.isOpen) {
      return;
    }

    this.connectPromise ??= this.client.connect().then(() => {
      this.logger.log('Redis connected');
    });

    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  private shouldConnectOnBoot(): boolean {
    if (!this.isConfigured()) {
      this.assertRequiredUrl('SESSION_REDIS_ENABLED');
      this.assertRequiredUrl('ADMIN_LOGIN_RATE_LIMIT_REDIS_ENABLED');
      return false;
    }

    return (
      this.configService.get<boolean>('SESSION_REDIS_ENABLED', false) ||
      this.configService.get<boolean>('ADMIN_LOGIN_RATE_LIMIT_REDIS_ENABLED', false)
    );
  }

  private assertRequiredUrl(featureFlag: string): void {
    if (this.configService.get<boolean>(featureFlag, false)) {
      throw new Error(`${featureFlag}=true requires REDIS_URL.`);
    }
  }

  private getRedisUrl(): string {
    return this.configService.get<string>('REDIS_URL', '').trim();
  }
}
