import { describe, expect, it, jest } from '@jest/globals';

import { OrderExpirationService } from './order-expiration.service';

describe('OrderExpirationService', () => {
  it('expires only orders that are still pending and records a system status history', async () => {
    const transaction = {
      order: {
        updateMany: jest
          .fn<(input: unknown) => Promise<{ count: number }>>()
          .mockResolvedValue({ count: 1 }),
      },
      orderStatusHistory: {
        create: jest.fn<(input: unknown) => Promise<void>>().mockResolvedValue(undefined),
      },
    };
    const prisma = {
      order: {
        findMany: jest
          .fn<() => Promise<Array<{ id: bigint; orderNumber: string }>>>()
          .mockResolvedValue([{ id: BigInt(11), orderNumber: 'D20260730-0001' }]),
      },
      $transaction: jest.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const notifications = {
      notifyOrderStatusChanged: jest.fn(),
    };
    const service = new OrderExpirationService(prisma as never, notifications as never);
    const now = new Date('2026-07-29T15:00:00.000Z');

    await expect(service.expireDueOrders(now)).resolves.toEqual({
      expiredOrderCount: 1,
      processedAt: now.toISOString(),
    });

    expect(transaction.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: BigInt(11),
        orderStatus: 'PENDING_PAYMENT',
        depositDeadlineAt: { lte: now },
      },
      data: {
        orderStatus: 'EXPIRED',
        expiredAt: now,
      },
    });
    expect(transaction.orderStatusHistory.create).toHaveBeenCalledWith({
      data: {
        orderId: BigInt(11),
        adminId: null,
        previousStatus: 'PENDING_PAYMENT',
        newStatus: 'EXPIRED',
        changeReason: '입금 기한 만료(시스템)',
      },
    });
    expect(notifications.notifyOrderStatusChanged).toHaveBeenCalledWith({
      orderId: 11,
      orderNumber: 'D20260730-0001',
      previousStatus: 'PENDING_PAYMENT',
      newStatus: 'EXPIRED',
      adminId: 0,
      changeReason: '입금 기한 만료(시스템)',
    });
  });

  it('does not create history or send a notification when another action already changed the order', async () => {
    const transaction = {
      order: {
        updateMany: jest.fn<() => Promise<{ count: number }>>().mockResolvedValue({ count: 0 }),
      },
      orderStatusHistory: {
        create: jest.fn(),
      },
    };
    const prisma = {
      order: {
        findMany: jest
          .fn<() => Promise<Array<{ id: bigint; orderNumber: string }>>>()
          .mockResolvedValue([{ id: BigInt(11), orderNumber: 'D20260730-0001' }]),
      },
      $transaction: jest.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const notifications = {
      notifyOrderStatusChanged: jest.fn(),
    };
    const service = new OrderExpirationService(prisma as never, notifications as never);

    await expect(service.expireDueOrders(new Date('2026-07-29T15:00:00.000Z'))).resolves.toMatchObject({
      expiredOrderCount: 0,
    });

    expect(transaction.orderStatusHistory.create).not.toHaveBeenCalled();
    expect(notifications.notifyOrderStatusChanged).not.toHaveBeenCalled();
  });
});
