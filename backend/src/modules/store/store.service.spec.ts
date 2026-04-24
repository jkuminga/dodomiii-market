import { DepositStatus } from '@prisma/client';

import { StoreService } from './store.service';

describe('StoreService deposit requests', () => {
  it('does not update state or notify admins when a deposit request is already pending', async () => {
    const requestedAt = new Date('2026-04-24T08:00:00.000Z');
    // tx : Prisma transaction에서 사용되는 가짜 클라이언트
    const tx = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: BigInt(1),
          orderNumber: 'DM20260424-0001',
          orderStatus: 'PAYMENT_REQUESTED',
          paymentRequestedAt: requestedAt,
          paymentConfirmedAt: null,
          contact: {
            buyerPhone: '010-1234-5678',
            receiverPhone: '010-8765-4321',
          },
          deposit: {
            depositStatus: DepositStatus.REQUESTED,
            requestedAt,
            confirmedAt: null,
          },
        }),
        update: jest.fn(),
      },
      deposit: {
        update: jest.fn(),
      },
      orderStatusHistory: {
        create: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
    };
    const orderNotifications = {
      notifyDepositRequested: jest.fn(),
    };
    const service = new StoreService(
      prisma as never,
      {} as never,
      orderNotifications as never,
      {} as never,
    );

    await expect(
      service.createDepositRequest('DM20260424-0001', {
        contactPhone: '01012345678',
        depositorName: '홍길동',
      }),
    ).resolves.toEqual({
      orderNumber: 'DM20260424-0001',
      orderStatus: 'PAYMENT_REQUESTED',
      depositStatus: DepositStatus.REQUESTED,
      requestedAt: requestedAt.toISOString(),
      confirmedAt: null,
      requestAccepted: false,
    });

    expect(tx.deposit.update).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
    expect(tx.orderStatusHistory.create).not.toHaveBeenCalled();
    expect(orderNotifications.notifyDepositRequested).not.toHaveBeenCalled();
  });
});
