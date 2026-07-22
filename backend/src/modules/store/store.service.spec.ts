import { DepositStatus, HomeItemSection, ShipmentStatus } from '@prisma/client';

import { StoreService } from './store.service';

describe('StoreService home popups', () => {
  it('returns every active popup in newest-first order', async () => {
    const createdAt = new Date('2026-04-03T10:00:00.000Z');
    const firstUpdatedAt = new Date('2026-04-04T10:00:00.000Z');
    const secondUpdatedAt = new Date('2026-04-04T09:00:00.000Z');
    const popups = [
      {
        id: BigInt(2),
        title: '두 번째 팝업',
        imageUrl: 'https://example.com/popup-2.jpg',
        linkUrl: 'https://example.com/event-2',
        isActive: true,
        createdAt,
        updatedAt: firstUpdatedAt,
      },
      {
        id: BigInt(1),
        title: null,
        imageUrl: 'https://example.com/popup-1.jpg',
        linkUrl: null,
        isActive: true,
        createdAt,
        updatedAt: secondUpdatedAt,
      },
    ];
    const prisma = {
      homePopup: {
        findMany: jest.fn().mockResolvedValue(popups),
      },
    };
    const storeCache = {
      getOrSet: jest.fn(async (_key: string, _ttlMs: number, factory: () => Promise<unknown>) => factory()),
    };
    const service = new StoreService(
      prisma as never,
      {} as never,
      {} as never,
      storeCache as never,
    );

    const result = await service.getActiveHomePopups();

    expect(storeCache.getOrSet).toHaveBeenCalledWith('store:home-popup:v2', expect.any(Number), expect.any(Function));
    expect(prisma.homePopup.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
    expect(result).toEqual({
      items: [
        {
          id: 2,
          title: '두 번째 팝업',
          imageUrl: 'https://example.com/popup-2.jpg',
          linkUrl: 'https://example.com/event-2',
          isActive: true,
          createdAt: createdAt.toISOString(),
          updatedAt: firstUpdatedAt.toISOString(),
        },
        {
          id: 1,
          title: null,
          imageUrl: 'https://example.com/popup-1.jpg',
          linkUrl: null,
          isActive: true,
          createdAt: createdAt.toISOString(),
          updatedAt: secondUpdatedAt.toISOString(),
        },
      ],
    });
  });
});

describe('StoreService home items', () => {
  it('returns active home items linked to visible products by section', async () => {
    const items = [
      {
        id: BigInt(3),
        section: HomeItemSection.NEW_ARRIVAL,
        title: '신상 꽃다발',
        imageUrl: 'https://example.com/new-arrival.jpg',
        sortOrder: 1,
        product: {
          id: BigInt(7),
          productCategories: [
            {
              category: {
                id: BigInt(2),
                name: '패브릭',
                slug: 'fabric',
              },
            },
          ],
          name: '포근포근 뜨개 꽃다발',
          slug: 'warm-flower',
          shortDescription: '포근한 신상품',
          basePrice: 12000,
          discountRate: 10,
          isSoldOut: false,
          consultationRequired: false,
          thumbnails: [{ imageUrl: 'https://example.com/thumb.jpg' }],
        },
      },
    ];
    const prisma = {
      homeItem: {
        findMany: jest.fn().mockResolvedValue(items),
      },
    };
    const storeCache = {
      getOrSet: jest.fn(async (_key: string, _ttlMs: number, factory: () => Promise<unknown>) => factory()),
    };
    const service = new StoreService(
      prisma as never,
      {} as never,
      {} as never,
      storeCache as never,
    );

    const result = await service.getActiveHomeItems(HomeItemSection.NEW_ARRIVAL);

    expect(storeCache.getOrSet).toHaveBeenCalledWith('store:home-items:v1:NEW_ARRIVAL', expect.any(Number), expect.any(Function));
    expect(prisma.homeItem.findMany).toHaveBeenCalledWith({
      where: {
        section: HomeItemSection.NEW_ARRIVAL,
        isActive: true,
        product: {
          isVisible: true,
          deletedAt: null,
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      take: 1,
      include: {
        product: {
          include: {
            productCategories: {
              orderBy: [{ categoryId: 'asc' }],
              include: {
                category: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
            thumbnails: {
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
              take: 1,
              select: {
                imageUrl: true,
              },
            },
          },
        },
      },
    });
    expect(result).toEqual({
      items: [
        {
          id: 3,
          section: HomeItemSection.NEW_ARRIVAL,
          title: '신상 꽃다발',
          imageUrl: 'https://example.com/new-arrival.jpg',
          productId: 7,
          productName: '포근포근 뜨개 꽃다발',
          productSlug: 'warm-flower',
          sortOrder: 1,
          product: {
            id: 7,
            categoryId: 2,
            categoryName: '패브릭',
            categories: [{ id: 2, name: '패브릭', slug: 'fabric' }],
            name: '포근포근 뜨개 꽃다발',
            slug: 'warm-flower',
            shortDescription: '포근한 신상품',
            basePrice: 12000,
            discountRate: 10,
            isSoldOut: false,
            consultationRequired: false,
            thumbnailImageUrl: 'https://example.com/thumb.jpg',
          },
        },
      ],
    });
  });
});

describe('StoreService public order lookup access', () => {
  it('rejects order detail lookup when contact phone is missing', async () => {
    const { service } = createStoreServiceWithOrderDetail();

    await expect(service.getOrderByOrderNumber('DM20260424-0001', '')).rejects.toHaveProperty(
      'response',
      {
        code: 'ORDER_NOT_FOUND',
        message: '주문 정보를 확인할 수 없습니다.',
      },
    );
  });

  it('rejects order detail lookup when contact phone does not match buyer or receiver phone', async () => {
    const { service } = createStoreServiceWithOrderDetail();

    await expect(
      service.getOrderByOrderNumber('DM20260424-0001', '010-0000-0000'),
    ).rejects.toHaveProperty(
      'response',
      {
        code: 'ORDER_NOT_FOUND',
        message: '주문 정보를 확인할 수 없습니다.',
      },
    );
  });

  it('returns order detail when contact phone matches and does not expose admin memo', async () => {
    const { service } = createStoreServiceWithOrderDetail();

    const result = await service.getOrderByOrderNumber('DM20260424-0001', '01012345678');

    expect(result.orderNumber).toBe('DM20260424-0001');
    expect(result.contact.buyerPhone).toBe('010-1234-5678');
    expect(result.deposit).not.toHaveProperty('adminMemo');
  });

  it('rejects order tracking lookup when contact phone does not match', async () => {
    const { service } = createStoreServiceWithOrderDetail();

    await expect(
      service.getOrderTracking('DM20260424-0001', '010-0000-0000'),
    ).rejects.toHaveProperty(
      'response',
      {
        code: 'ORDER_NOT_FOUND',
        message: '주문 정보를 확인할 수 없습니다.',
      },
    );
  });

  it('returns order tracking when contact phone matches receiver phone', async () => {
    const { service } = createStoreServiceWithOrderDetail();

    const result = await service.getOrderTracking('DM20260424-0001', '01087654321');

    expect(result).toMatchObject({
      orderNumber: 'DM20260424-0001',
      orderStatus: 'PAYMENT_CONFIRMED',
      shipmentStatus: ShipmentStatus.SHIPPED,
      courierName: 'CJ대한통운',
      trackingNumber: '1234567890',
    });
    expect(result.trackingUrl).toBe('https://tracker.example.com/1234567890');
  });
});

describe('StoreService deposit requests', () => {
  it('does not update state or notify admins when contact phone is missing', async () => {
    const { service, tx, orderNotifications } = createDepositRequestService();

    await expect(
      service.createDepositRequest('DM20260424-0001', {
        contactPhone: '',
        depositorName: '홍길동',
      }),
    ).rejects.toHaveProperty('response', {
      code: 'ORDER_NOT_FOUND',
      message: '주문 정보를 확인할 수 없습니다.',
    });

    expect(tx.deposit.update).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
    expect(tx.orderStatusHistory.create).not.toHaveBeenCalled();
    expect(orderNotifications.notifyDepositRequested).not.toHaveBeenCalled();
  });

  it('does not update state or notify admins when contact phone does not match', async () => {
    const { service, tx, orderNotifications } = createDepositRequestService();

    await expect(
      service.createDepositRequest('DM20260424-0001', {
        contactPhone: '010-0000-0000',
        depositorName: '홍길동',
      }),
    ).rejects.toHaveProperty('response', {
      code: 'ORDER_NOT_FOUND',
      message: '주문 정보를 확인할 수 없습니다.',
    });

    expect(tx.deposit.update).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
    expect(tx.orderStatusHistory.create).not.toHaveBeenCalled();
    expect(orderNotifications.notifyDepositRequested).not.toHaveBeenCalled();
  });

  it('accepts a deposit request when contact phone matches buyer phone', async () => {
    const { service, tx, orderNotifications } = createDepositRequestService();

    const result = await service.createDepositRequest('DM20260424-0001', {
      contactPhone: '01012345678',
      depositorName: '홍길동',
      memo: '홍길동 이름으로 입금했습니다',
    });

    expect(result).toMatchObject({
      orderNumber: 'DM20260424-0001',
      orderStatus: 'PAYMENT_REQUESTED',
      depositStatus: DepositStatus.REQUESTED,
      confirmedAt: null,
      requestAccepted: true,
    });
    expect(result.requestedAt).toEqual(expect.any(String));
    expect(tx.deposit.update).toHaveBeenCalledWith({
      where: {
        orderId: BigInt(1),
      },
      data: {
        depositorName: '홍길동',
        requestedAt: expect.any(Date),
        depositStatus: DepositStatus.REQUESTED,
      },
    });
    expect(tx.order.update).toHaveBeenCalledWith({
      where: {
        id: BigInt(1),
      },
      data: {
        orderStatus: 'PAYMENT_REQUESTED',
        paymentRequestedAt: expect.any(Date),
      },
    });
    expect(tx.orderStatusHistory.create).toHaveBeenCalledWith({
      data: {
        orderId: BigInt(1),
        previousStatus: 'PENDING_PAYMENT',
        newStatus: 'PAYMENT_REQUESTED',
        changeReason: '입금 요청 접수: 홍길동 이름으로 입금했습니다',
      },
    });
    expect(orderNotifications.notifyDepositRequested).toHaveBeenCalledWith({
      orderId: 1,
      orderNumber: 'DM20260424-0001',
    });
  });

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

function createDepositRequestService() {
  const tx = {
    order: {
      findUnique: jest.fn().mockResolvedValue({
        id: BigInt(1),
        orderNumber: 'DM20260424-0001',
        orderStatus: 'PENDING_PAYMENT',
        paymentRequestedAt: null,
        paymentConfirmedAt: null,
        contact: {
          buyerPhone: '010-1234-5678',
          receiverPhone: '010-8765-4321',
        },
        deposit: {
          depositStatus: DepositStatus.WAITING,
          requestedAt: null,
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

  return { service, tx, prisma, orderNotifications };
}

function createStoreServiceWithOrderDetail() {
  const orderDetail = createOrderDetailRecord();
  const prisma = {
    order: {
      findUnique: jest.fn().mockResolvedValue(orderDetail),
    },
  };
  const service = new StoreService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
  );

  return { service, prisma, orderDetail };
}

function createOrderDetailRecord() {
  const createdAt = new Date('2026-04-24T08:00:00.000Z');
  const updatedAt = new Date('2026-04-24T08:30:00.000Z');
  const shippedAt = new Date('2026-04-24T09:00:00.000Z');

  return {
    id: BigInt(1),
    orderNumber: 'DM20260424-0001',
    orderStatus: 'PAYMENT_CONFIRMED',
    totalProductPrice: 20000,
    shippingFee: 3000,
    finalTotalPrice: 23000,
    customerRequest: null,
    depositDeadlineAt: new Date('2026-04-25T08:00:00.000Z'),
    createdAt,
    updatedAt,
    items: [
      {
        productNameSnapshot: '테스트 상품',
        product: {
          thumbnails: [
            {
              imageUrl: 'https://example.com/thumb.jpg',
            },
          ],
        },
        optionNameSnapshot: '색상',
        optionValueSnapshot: '분홍',
        unitPrice: 20000,
        quantity: 1,
        lineTotalPrice: 20000,
      },
    ],
    contact: {
      buyerName: '구매자',
      buyerPhone: '010-1234-5678',
      receiverName: '수령자',
      receiverPhone: '010-8765-4321',
      zipcode: '12345',
      address1: '서울시 테스트구',
      address2: '101호',
    },
    deposit: {
      bankName: '국민은행',
      accountHolder: '도도미마켓',
      accountNumber: '000-00-000000',
      expectedAmount: 23000,
      depositorName: null,
      requestedAt: null,
      confirmedAt: null,
      depositStatus: DepositStatus.WAITING,
      adminMemo: 'public response must not expose this',
    },
    shipment: {
      shipmentStatus: ShipmentStatus.SHIPPED,
      courierName: 'CJ대한통운',
      trackingNumber: '1234567890',
      shippedAt,
      deliveredAt: null,
    },
    statusHistories: [
      {
        newStatus: 'PAYMENT_CONFIRMED',
        changeReason: '입금 확인',
        createdAt: updatedAt,
      },
    ],
  };
}
