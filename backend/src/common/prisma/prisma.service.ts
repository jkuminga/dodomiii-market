import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

function appendConnectionLimit(url: string | undefined, connectionLimit: number): string | undefined {
  if (!url) {
    return undefined;
  }

  const parsed = new URL(url);
  if (!parsed.searchParams.has('connection_limit')) {
    parsed.searchParams.set('connection_limit', String(connectionLimit));
  }

  return parsed.toString();
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private keepWarmTimer: NodeJS.Timeout | null = null;

  constructor(private readonly configService: ConfigService) {
    super({
      datasources: {
        db: {
          url: appendConnectionLimit(configService.get<string>('DATABASE_URL'), 1),
        },
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.startKeepWarm();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.keepWarmTimer) {
      clearInterval(this.keepWarmTimer);
      this.keepWarmTimer = null;
    }
    await this.$disconnect();
  }

  private startKeepWarm(): void {
    const enabled = this.configService.get<boolean>('DB_KEEP_WARM_ENABLED', true);
    if (!enabled) {
      return;
    }

    const intervalMs = Math.max(this.configService.get<number>('DB_KEEP_WARM_INTERVAL_MS', 600_000), 60_000);

    this.logger.log(`DB keep-warm enabled interval=${intervalMs}ms`);

    this.keepWarmTimer = setInterval(() => {
      void this.runKeepWarmQuery();
    }, intervalMs);

    this.keepWarmTimer.unref();
  }

  private async runKeepWarmQuery(): Promise<void> {
    try {
      await this.$queryRaw`SELECT 1`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`DB keep-warm ping failed: ${message}`);
    }
  }
}
