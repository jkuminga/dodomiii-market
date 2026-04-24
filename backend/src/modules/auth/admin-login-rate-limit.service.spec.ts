import { HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RedisService } from '../../common/redis/redis.service';
import { AdminLoginRateLimitService } from './admin-login-rate-limit.service';

describe('AdminLoginRateLimitService', () => {
  const redisClient = {
    get: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    del: jest.fn(),
  };

  const redisService = {
    getClient: jest.fn(),
    buildKey: jest.fn((suffix: string) => `dodomi:${suffix}`),
  } as unknown as RedisService;

  const configService = {
    get: jest.fn(),
  } as unknown as ConfigService;

  const configValues = new Map<string, unknown>();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    configValues.clear();
    configValues.set('ADMIN_LOGIN_RATE_LIMIT_REDIS_ENABLED', true);
    configValues.set('ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS', 900);
    configValues.set('ADMIN_LOGIN_RATE_LIMIT_IP_MAX_ATTEMPTS', 20);
    configValues.set('ADMIN_LOGIN_RATE_LIMIT_ACCOUNT_IP_MAX_ATTEMPTS', 5);

    jest.mocked(configService.get).mockImplementation((key: string, fallback?: unknown) =>
      configValues.has(key) ? configValues.get(key) : fallback,
    );
    jest.mocked(redisService.getClient).mockResolvedValue(redisClient as never);
    redisClient.get.mockResolvedValue(null);
    redisClient.incr.mockResolvedValue(1);
    redisClient.expire.mockResolvedValue(1);
    redisClient.del.mockResolvedValue(1);
  });

  it('does nothing when Redis-backed login rate limit is disabled', async () => {
    configValues.set('ADMIN_LOGIN_RATE_LIMIT_REDIS_ENABLED', false);
    const service = createService();

    await service.checkOrThrow('admin', '127.0.0.1');
    await service.recordFailure('admin', '127.0.0.1');
    await service.resetAccountIp('admin', '127.0.0.1');

    expect(redisService.getClient).not.toHaveBeenCalled();
  });

  it('allows login attempts while counters are below the limit', async () => {
    redisClient.get.mockResolvedValueOnce('19').mockResolvedValueOnce('4');
    const service = createService();

    await expect(service.checkOrThrow('admin', '127.0.0.1')).resolves.toBeUndefined();
  });

  it('throws 429 when the IP counter reaches the limit', async () => {
    redisClient.get.mockResolvedValueOnce('20').mockResolvedValueOnce('0');
    const service = createService();

    await expect(service.checkOrThrow('admin', '127.0.0.1')).rejects.toHaveProperty(
      'status',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  });

  it('throws 429 when the loginId and IP counter reaches the limit', async () => {
    redisClient.get.mockResolvedValueOnce('0').mockResolvedValueOnce('5');
    const service = createService();

    await expect(service.checkOrThrow('admin', '127.0.0.1')).rejects.toHaveProperty(
      'status',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  });

  it('increments both counters and sets TTL for first failures', async () => {
    const service = createService();

    await service.recordFailure('Admin', '127.0.0.1');

    expect(redisClient.incr).toHaveBeenCalledWith('dodomi:admin-login:ip:127.0.0.1');
    expect(redisClient.incr).toHaveBeenCalledWith(
      'dodomi:admin-login:account:admin:ip:127.0.0.1',
    );
    expect(redisClient.expire).toHaveBeenCalledTimes(2);
    expect(redisClient.expire).toHaveBeenCalledWith('dodomi:admin-login:ip:127.0.0.1', 900);
    expect(redisClient.expire).toHaveBeenCalledWith(
      'dodomi:admin-login:account:admin:ip:127.0.0.1',
      900,
    );
  });

  it('does not reset the IP counter after successful login', async () => {
    const service = createService();

    await service.resetAccountIp('Admin', '127.0.0.1');

    expect(redisClient.del).toHaveBeenCalledTimes(1);
    expect(redisClient.del).toHaveBeenCalledWith(
      'dodomi:admin-login:account:admin:ip:127.0.0.1',
    );
  });

  function createService(): AdminLoginRateLimitService {
    return new AdminLoginRateLimitService(configService, redisService);
  }
});
