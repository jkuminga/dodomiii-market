import {
  DepositStatus,
  PrismaClient,
  ProductImageType,
  ShipmentStatus,
} from '@prisma/client';
import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';

import { StoreCacheService } from './store-cache.service';
import { StoreService } from './store.service';

const TEST_PREFIX = '[TEST] StoreService order tracking integration';

jest.setTimeout(30_000);

describe('StoreService order lookup and tracking integration', () => {
  const prisma = new PrismaClient();
  const service = new StoreService(
    prisma as never,
    { get: jest.fn((_: string, defaultValue?: unknown) => defaultValue) } as never,
    {
      notifyNewOrderCreated: jest.fn(),
      notifyDepositRequested: jest.fn(),
      notifyOrderStatusChanged: jest.fn(),
      notifyOrderShipmentUpdated: jest.fn(),
    } as never,
    new StoreCacheService(),
  );
  const createdOrderIds: bigint[] = [];
  const createdProductIds: bigint[] = [];
  const createdCategoryIds: bigint[] = [];

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterEach(async () => {
    await cleanupCreatedRows();
  });

  afterAll(async () => {
    await cleanupCreatedRows();
    await prisma.$disconnect();
  });

  it('returns order detail with item, contact, deposit, shipment, and tracking event snapshots', async () => {
    const fixture = await createOrderDetailFixture();

    const result = await service.getOrderByOrderNumber(fixture.order.orderNumber, '01011112222');

    expect(result).toMatchObject({
      orderNumber: fixture.order.orderNumber,
      orderStatus: 'DELIVERED',
      customerRequest: '배송 전 연락 부탁드립니다',
      contact: {
        buyerName: '통합테스트 구매자',
        buyerPhone: '010-1111-2222',
        receiverName: '통합테스트 수령자',
        receiverPhone: '010-3333-4444',
        zipcode: '12345',
        address1: '서울 성동구 테스트로 1',
        address2: '101호',
      },
      pricing: {
        totalProductPrice: 20000,
        shippingFee: 3000,
        finalTotalPrice: 23000,
      },
      deposit: {
        depositStatus: DepositStatus.CONFIRMED,
        bankName: '테스트은행',
        accountHolder: '테스트예금주',
        accountNumber: '000-00-TEST',
        expectedAmount: 23000,
        depositorName: '홍길동',
      },
      shipment: {
        shipmentStatus: ShipmentStatus.DELIVERED,
        courierName: 'CJ대한통운',
        trackingNumber: '1234567890',
        trackingUrl: 'https://tracker.example.com/1234567890',
      },
    });
    expect(result.items).toEqual([
      {
        productNameSnapshot: fixture.product.name,
        thumbnailImageUrl: 'https://example.test/order-thumb.jpg',
        optionNameSnapshot: '포장',
        optionValueSnapshot: '포장: 기본',
        unitPrice: 10000,
        quantity: 2,
        lineTotalPrice: 20000,
      },
    ]);
    expect(result.deposit.requestedAt).toBe('2026-04-24T01:00:00.000Z');
    expect(result.deposit.confirmedAt).toBe('2026-04-24T02:00:00.000Z');
    expect(result.deposit.depositDeadlineAt).toBe('2026-04-25T14:59:59.000Z');
    expect(result.shipment.shippedAt).toBe('2026-04-24T03:00:00.000Z');
    expect(result.shipment.deliveredAt).toBe('2026-04-25T04:00:00.000Z');
    expect(result.trackingEvents.map((event) => event.status)).toEqual([
      'PENDING_PAYMENT',
      'PAYMENT_CONFIRMED',
      'SHIPPED',
      'DELIVERED',
    ]);
  });

  it('returns tracking response with events sorted by occurrence time', async () => {
    const fixture = await createOrderDetailFixture();

    const result = await service.getOrderTracking(fixture.order.orderNumber, '01033334444');

    expect(result).toMatchObject({
      orderNumber: fixture.order.orderNumber,
      orderStatus: 'DELIVERED',
      shipmentStatus: ShipmentStatus.DELIVERED,
      courierName: 'CJ대한통운',
      trackingNumber: '1234567890',
      trackingUrl: 'https://tracker.example.com/1234567890',
      shippedAt: '2026-04-24T03:00:00.000Z',
      deliveredAt: '2026-04-25T04:00:00.000Z',
    });
    expect(result.events).toEqual([
      {
        source: 'ORDER',
        status: 'PENDING_PAYMENT',
        label: '주문 접수',
        occurredAt: '2026-04-24T00:00:00.000Z',
        description: '주문이 접수되었습니다.',
      },
      {
        source: 'ORDER',
        status: 'PAYMENT_CONFIRMED',
        label: '입금 확인 완료',
        occurredAt: '2026-04-24T02:00:00.000Z',
        description: '입금 확인',
      },
      {
        source: 'SHIPMENT',
        status: 'SHIPPED',
        label: '배송 시작',
        occurredAt: '2026-04-24T03:00:00.000Z',
        description: 'CJ대한통운 / 1234567890',
      },
      {
        source: 'SHIPMENT',
        status: 'DELIVERED',
        label: '배송 완료',
        occurredAt: '2026-04-25T04:00:00.000Z',
        description: 'CJ대한통운 / 1234567890',
      },
    ]);
  });

  async function createOrderDetailFixture() {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const category = await prisma.category.create({
      data: {
        name: `${TEST_PREFIX} category ${suffix}`,
        slug: `test-order-tracking-category-${suffix}`,
        isVisible: true,
      },
    });
    createdCategoryIds.push(category.id);

    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        name: `${TEST_PREFIX} product ${suffix}`,
        slug: `test-order-tracking-product-${suffix}`,
        basePrice: 10000,
        isVisible: true,
        isSoldOut: false,
      },
    });
    createdProductIds.push(product.id);

    await prisma.productImage.create({
      data: {
        productId: product.id,
        imageType: ProductImageType.THUMBNAIL,
        imageUrl: 'https://example.test/order-thumb.jpg',
        sortOrder: 0,
      },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `TRK-${suffix}`,
        orderStatus: 'DELIVERED',
        totalProductPrice: 20000,
        shippingFee: 3000,
        finalTotalPrice: 23000,
        customerRequest: '배송 전 연락 부탁드립니다',
        depositDeadlineAt: new Date('2026-04-25T14:59:59.000Z'),
        paymentRequestedAt: new Date('2026-04-24T01:00:00.000Z'),
        paymentConfirmedAt: new Date('2026-04-24T02:00:00.000Z'),
        createdAt: new Date('2026-04-24T00:00:00.000Z'),
        items: {
          create: {
            productId: product.id,
            productNameSnapshot: product.name,
            optionNameSnapshot: '포장',
            optionValueSnapshot: '포장: 기본',
            unitPrice: 10000,
            quantity: 2,
            lineTotalPrice: 20000,
          },
        },
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
            depositorName: '홍길동',
            requestedAt: new Date('2026-04-24T01:00:00.000Z'),
            confirmedAt: new Date('2026-04-24T02:00:00.000Z'),
            depositStatus: DepositStatus.CONFIRMED,
            adminMemo: '고객 공개 응답에 노출되면 안 되는 메모',
          },
        },
        shipment: {
          create: {
            shipmentStatus: ShipmentStatus.DELIVERED,
            courierName: 'CJ대한통운',
            trackingNumber: '1234567890',
            shippedAt: new Date('2026-04-24T03:00:00.000Z'),
            deliveredAt: new Date('2026-04-25T04:00:00.000Z'),
          },
        },
        statusHistories: {
          create: {
            previousStatus: 'PAYMENT_REQUESTED',
            newStatus: 'PAYMENT_CONFIRMED',
            changeReason: '입금 확인',
            createdAt: new Date('2026-04-24T02:00:00.000Z'),
          },
        },
      },
    });
    createdOrderIds.push(order.id);

    return {
      category,
      product,
      order,
    };
  }

  async function cleanupCreatedRows() {
    if (createdOrderIds.length > 0) {
      await prisma.order.deleteMany({
        where: {
          id: {
            in: createdOrderIds.splice(0),
          },
        },
      });
    }

    if (createdProductIds.length > 0) {
      await prisma.product.deleteMany({
        where: {
          id: {
            in: createdProductIds.splice(0),
          },
        },
      });
    }

    if (createdCategoryIds.length > 0) {
      await prisma.category.deleteMany({
        where: {
          id: {
            in: createdCategoryIds.splice(0),
          },
        },
      });
    }
  }
});
