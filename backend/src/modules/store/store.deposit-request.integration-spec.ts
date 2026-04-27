import { DepositStatus, PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';

import { StoreCacheService } from './store-cache.service';
import { StoreService } from './store.service';

const TEST_PREFIX = '[TEST] StoreService deposit request integration';

jest.setTimeout(30_000);

describe('StoreService deposit request integration', () => {
  const prisma = new PrismaClient();
  const orderNotifications = {
    notifyNewOrderCreated: jest.fn(),
    notifyDepositRequested: jest.fn(),
    notifyOrderStatusChanged: jest.fn(),
    notifyOrderShipmentUpdated: jest.fn(),
  };
  const service = new StoreService(
    prisma as never,
    { get: jest.fn((_: string, defaultValue?: unknown) => defaultValue) } as never,
    orderNotifications as never,
    new StoreCacheService(),
  );
  const createdOrderIds: bigint[] = [];

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterEach(async () => {
    await cleanupCreatedRows();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await cleanupCreatedRows();
    await prisma.$disconnect();
  });

  it('accepts a pending payment deposit request and updates order, deposit, and history rows', async () => {
    const order = await createOrderWithDeposit({
      orderStatus: 'PENDING_PAYMENT',
      depositStatus: DepositStatus.WAITING,
    });

    const result = await service.createDepositRequest(order.orderNumber, {
      contactPhone: '01011112222',
      depositorName: '홍길동',
      memo: '홍길동 이름으로 입금했습니다',
    });

    expect(result).toMatchObject({
      orderNumber: order.orderNumber,
      orderStatus: 'PAYMENT_REQUESTED',
      depositStatus: DepositStatus.REQUESTED,
      confirmedAt: null,
      requestAccepted: true,
    });
    expect(result.requestedAt).toEqual(expect.any(String));
    expect(orderNotifications.notifyDepositRequested).toHaveBeenCalledWith({
      orderId: Number(order.id),
      orderNumber: order.orderNumber,
    });

    const updatedOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        deposit: true,
        statusHistories: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    expect(updatedOrder).toMatchObject({
      orderStatus: 'PAYMENT_REQUESTED',
      paymentConfirmedAt: null,
    });
    expect(updatedOrder?.paymentRequestedAt).toEqual(expect.any(Date));
    expect(updatedOrder?.deposit).toMatchObject({
      depositStatus: DepositStatus.REQUESTED,
      depositorName: '홍길동',
      confirmedAt: null,
    });
    expect(updatedOrder?.deposit?.requestedAt).toEqual(expect.any(Date));
    expect(updatedOrder?.statusHistories).toHaveLength(1);
    expect(updatedOrder?.statusHistories[0]).toMatchObject({
      previousStatus: 'PENDING_PAYMENT',
      newStatus: 'PAYMENT_REQUESTED',
      changeReason: '입금 요청 접수: 홍길동 이름으로 입금했습니다',
    });
  });

  it('returns requestAccepted=false without changing rows when deposit request is already pending', async () => {
    const requestedAt = new Date('2026-04-24T08:00:00.000Z');
    const order = await createOrderWithDeposit({
      orderStatus: 'PAYMENT_REQUESTED',
      depositStatus: DepositStatus.REQUESTED,
      paymentRequestedAt: requestedAt,
      depositRequestedAt: requestedAt,
      depositorName: '기존입금자',
    });

    const result = await service.createDepositRequest(order.orderNumber, {
      contactPhone: '01033334444',
      depositorName: '새입금자',
      memo: '다시 요청합니다',
    });

    expect(result).toEqual({
      orderNumber: order.orderNumber,
      orderStatus: 'PAYMENT_REQUESTED',
      depositStatus: DepositStatus.REQUESTED,
      requestedAt: requestedAt.toISOString(),
      confirmedAt: null,
      requestAccepted: false,
    });
    expect(orderNotifications.notifyDepositRequested).not.toHaveBeenCalled();

    const unchangedOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        deposit: true,
        statusHistories: true,
      },
    });

    expect(unchangedOrder?.paymentRequestedAt?.toISOString()).toBe(requestedAt.toISOString());
    expect(unchangedOrder?.deposit).toMatchObject({
      depositStatus: DepositStatus.REQUESTED,
      depositorName: '기존입금자',
    });
    expect(unchangedOrder?.deposit?.requestedAt?.toISOString()).toBe(requestedAt.toISOString());
    expect(unchangedOrder?.statusHistories).toHaveLength(0);
  });

  it('rejects requests with non-matching contact phone and leaves rows unchanged', async () => {
    const order = await createOrderWithDeposit({
      orderStatus: 'PENDING_PAYMENT',
      depositStatus: DepositStatus.WAITING,
    });

    await expect(
      service.createDepositRequest(order.orderNumber, {
        contactPhone: '010-0000-0000',
        depositorName: '홍길동',
      }),
    ).rejects.toHaveProperty('response', {
      code: 'ORDER_NOT_FOUND',
      message: '주문 정보를 확인할 수 없습니다.',
    });
    expect(orderNotifications.notifyDepositRequested).not.toHaveBeenCalled();

    const unchangedOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        deposit: true,
        statusHistories: true,
      },
    });

    expect(unchangedOrder).toMatchObject({
      orderStatus: 'PENDING_PAYMENT',
      paymentRequestedAt: null,
    });
    expect(unchangedOrder?.deposit).toMatchObject({
      depositStatus: DepositStatus.WAITING,
      depositorName: null,
      requestedAt: null,
    });
    expect(unchangedOrder?.statusHistories).toHaveLength(0);
  });

  async function createOrderWithDeposit(input: {
    orderStatus: 'PENDING_PAYMENT' | 'PAYMENT_REQUESTED';
    depositStatus: DepositStatus;
    paymentRequestedAt?: Date;
    depositRequestedAt?: Date;
    depositorName?: string;
  }) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const order = await prisma.order.create({
      data: {
        orderNumber: `TST-${suffix}`,
        orderStatus: input.orderStatus,
        totalProductPrice: 20000,
        shippingFee: 3000,
        finalTotalPrice: 23000,
        paymentRequestedAt: input.paymentRequestedAt,
        depositDeadlineAt: new Date('2026-04-25T14:59:59.000Z'),
        customerRequest: `${TEST_PREFIX} request`,
        contact: {
          create: {
            buyerName: '통합테스트 구매자',
            buyerPhone: '010-1111-2222',
            receiverName: '통합테스트 수령자',
            receiverPhone: '010-3333-4444',
            zipcode: '12345',
            address1: '서울 성동구 테스트로 1',
            address2: '101호',
          },
        },
        deposit: {
          create: {
            bankName: '테스트은행',
            accountHolder: '테스트예금주',
            accountNumber: '000-00-TEST',
            expectedAmount: 23000,
            depositorName: input.depositorName ?? null,
            requestedAt: input.depositRequestedAt,
            depositStatus: input.depositStatus,
          },
        },
      },
    });
    createdOrderIds.push(order.id);

    return order;
  }

  async function cleanupCreatedRows() {
    if (createdOrderIds.length === 0) {
      return;
    }

    await prisma.order.deleteMany({
      where: {
        id: {
          in: createdOrderIds.splice(0),
        },
      },
    });
  }
});
