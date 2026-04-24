import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class AdminLoginRateLimitService {
  private readonly logger = new Logger(AdminLoginRateLimitService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async checkOrThrow(loginId: string, ip: string): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    const client = await this.redisService.getClient();
    const [ipCount, accountIpCount] = await Promise.all([
      client.get(this.getIpKey(ip)),
      client.get(this.getAccountIpKey(loginId, ip)),
    ]);

    if (
      Number(ipCount ?? 0) >= this.getIpMaxAttempts() ||
      Number(accountIpCount ?? 0) >= this.getAccountIpMaxAttempts()
    ) {
      this.logger.warn(`Admin login rate limit exceeded ip=${this.normalizeLogValue(ip)}`);
      throw new HttpException(
        {
          code: 'TOO_MANY_LOGIN_ATTEMPTS',
          message: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async recordFailure(loginId: string, ip: string): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    await Promise.all([
      this.incrementWithTtl(this.getIpKey(ip)),
      this.incrementWithTtl(this.getAccountIpKey(loginId, ip)),
    ]);
  }

  async resetAccountIp(loginId: string, ip: string): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    const client = await this.redisService.getClient();
    await client.del(this.getAccountIpKey(loginId, ip));
  }

  private async incrementWithTtl(key: string): Promise<void> {
    const client = await this.redisService.getClient();
    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, this.getWindowSeconds());
    }
  }

  private getIpKey(ip: string): string {
    return this.redisService.buildKey(`admin-login:ip:${this.normalizeKeyPart(ip)}`);
  }

  private getAccountIpKey(loginId: string, ip: string): string {
    const normalizedLoginId = loginId.trim().toLowerCase();
    return this.redisService.buildKey(
      `admin-login:account:${this.normalizeKeyPart(normalizedLoginId)}:ip:${this.normalizeKeyPart(ip)}`,
    );
  }

  private normalizeKeyPart(value: string): string {
    return encodeURIComponent(value.trim() || 'unknown');
  }

  private normalizeLogValue(value: string): string {
    return value.trim() || 'unknown';
  }

  private isEnabled(): boolean {
    return this.configService.get<boolean>('ADMIN_LOGIN_RATE_LIMIT_REDIS_ENABLED', false);
  }

  private getWindowSeconds(): number {
    return this.getPositiveNumber('ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS', 900);
  }

  private getIpMaxAttempts(): number {
    return this.getPositiveNumber('ADMIN_LOGIN_RATE_LIMIT_IP_MAX_ATTEMPTS', 20);
  }

  private getAccountIpMaxAttempts(): number {
    return this.getPositiveNumber('ADMIN_LOGIN_RATE_LIMIT_ACCOUNT_IP_MAX_ATTEMPTS', 5);
  }

  private getPositiveNumber(key: string, fallback: number): number {
    const value = Number(this.configService.get<number | string>(key, fallback));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
