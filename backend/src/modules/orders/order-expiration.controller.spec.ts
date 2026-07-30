import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';

import { OrderExpirationController } from './order-expiration.controller';

describe('OrderExpirationController', () => {
  it('runs the expiration service only with the configured Cron bearer token', async () => {
    const expirationService = {
      expireDueOrders: jest.fn<() => Promise<{ expiredOrderCount: number }>>().mockResolvedValue({
        expiredOrderCount: 2,
      }),
    };
    const controller = new OrderExpirationController(
      { get: jest.fn().mockReturnValue('cron-secret') } as never,
      expirationService as never,
    );

    await expect(controller.expireOrders('Bearer cron-secret')).resolves.toEqual({
      success: true,
      data: { expiredOrderCount: 2 },
    });
    expect(expirationService.expireDueOrders).toHaveBeenCalledTimes(1);
  });

  it('rejects an absent or invalid Cron bearer token', async () => {
    const controller = new OrderExpirationController(
      { get: jest.fn().mockReturnValue('cron-secret') } as never,
      { expireDueOrders: jest.fn() } as never,
    );

    await expect(controller.expireOrders(undefined)).rejects.toThrow(UnauthorizedException);
    await expect(controller.expireOrders('Bearer incorrect-secret')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
