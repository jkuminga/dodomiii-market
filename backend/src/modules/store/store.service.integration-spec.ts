import {
  DepositStatus,
  PrismaClient,
  ProductImageType,
  ProductOptionSelectionType,
} from '@prisma/client';
import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';

import { StoreCacheService } from './store-cache.service';
import { StoreService } from './store.service';

const TEST_PREFIX = '[TEST] StoreService integration';
const SHIPPING_FEE = 3000;
const DEPOSIT_DEADLINE_DAYS = 1;

jest.setTimeout(30_000);

describe('StoreService integration', () => {
  const prisma = new PrismaClient();
  const orderNotifications = {
    notifyNewOrderCreated: jest.fn(),
    notifyDepositRequested: jest.fn(),
    notifyOrderStatusChanged: jest.fn(),
    notifyOrderShipmentUpdated: jest.fn(),
  };
  const configService = {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      const values: Record<string, unknown> = {
        ORDER_SHIPPING_FEE: SHIPPING_FEE,
        ORDER_DEPOSIT_DEADLINE_DAYS: DEPOSIT_DEADLINE_DAYS,
        ORDER_DEPOSIT_BANK_NAME: '테스트은행',
        ORDER_DEPOSIT_ACCOUNT_HOLDER: '테스트예금주',
        ORDER_DEPOSIT_ACCOUNT_NUMBER: '000-00-TEST',
      };

      return values[key] ?? defaultValue;
    }),
  };
  const service = new StoreService(
    prisma as never,
    configService as never,
    orderNotifications as never,
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
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await cleanupCreatedRows();
    await prisma.$disconnect();
  });

  it('creates a regular order with product, option, contact, and deposit records', async () => {
    const fixture = await createOrderFixture();

    const result = await service.createOrder({
      items: [
        {
          productId: Number(fixture.product.id),
          quantity: 2,
          selectedOptions: [
            {
              productOptionGroupId: Number(fixture.optionGroup.id),
              productOptionId: Number(fixture.option.id),
              quantity: 2,
            },
          ],
        },
      ],
      contact: {
        buyerName: '통합테스트 구매자',
        buyerPhone: '010-1111-2222',
        receiverName: '통합테스트 수령자',
        receiverPhone: '010-3333-4444',
        zipcode: '12345',
        address1: 'R',
        roadAddress: '서울 성동구 테스트로 1',
        jibunAddress: '서울 성동구 테스트동 1',
        address2: '  101호  ',
      },
      customerRequest: '문 앞에 놓아주세요',
    });
    createdOrderIds.push(BigInt(result.orderId));

    expect(result.orderNumber).toMatch(/^DM\d{8}-\d{4}$/);
    expect(result.orderStatus).toBe('PENDING_PAYMENT');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      productId: Number(fixture.product.id),
      productOptionId: null,
      productNameSnapshot: fixture.product.name,
      optionNameSnapshot: '포장',
      optionValueSnapshot: '포장: 선물 포장 x2',
      unitPrice: 12000,
      quantity: 2,
      lineTotalPrice: 24000,
      selectedOptions: [
        {
          productOptionGroupId: Number(fixture.optionGroup.id),
          productOptionId: Number(fixture.option.id),
          groupNameSnapshot: '포장',
          optionNameSnapshot: '선물 포장',
          extraPriceSnapshot: 1500,
          quantity: 2,
        },
      ],
    });
    expect(result.pricing).toEqual({
      totalProductPrice: 24000,
      shippingFee: SHIPPING_FEE,
      finalTotalPrice: 27000,
    });
    expect(result.depositInfo).toMatchObject({
      expectedAmount: 27000,
      depositStatus: DepositStatus.WAITING,
    });
    expect(result.depositInfo.depositDeadlineAt).toEqual(expect.any(String));
    expect(orderNotifications.notifyNewOrderCreated).toHaveBeenCalledWith({
      orderId: result.orderId,
      orderNumber: result.orderNumber,
    });

    const order = await prisma.order.findUnique({
      where: { orderNumber: result.orderNumber },
      include: {
        items: {
          include: {
            optionSelections: true,
          },
        },
        contact: true,
        deposit: true,
      },
    });

    expect(order).not.toBeNull();
    expect(order).toMatchObject({
      orderStatus: 'PENDING_PAYMENT',
      totalProductPrice: 24000,
      shippingFee: SHIPPING_FEE,
      finalTotalPrice: 27000,
      customerRequest: '문 앞에 놓아주세요',
    });
    expect(order?.items).toHaveLength(1);
    expect(order?.items[0]).toMatchObject({
      productId: fixture.product.id,
      productOptionId: null,
      productNameSnapshot: fixture.product.name,
      optionNameSnapshot: '포장',
      optionValueSnapshot: '포장: 선물 포장 x2',
      unitPrice: 12000,
      quantity: 2,
      lineTotalPrice: 24000,
    });
    expect(order?.items[0].optionSelections).toHaveLength(1);
    expect(order?.items[0].optionSelections[0]).toMatchObject({
      productOptionGroupId: fixture.optionGroup.id,
      productOptionId: fixture.option.id,
      groupNameSnapshot: '포장',
      optionNameSnapshot: '선물 포장',
      extraPriceSnapshot: 1500,
      quantity: 2,
    });
    expect(order?.contact).toMatchObject({
      buyerName: '통합테스트 구매자',
      buyerPhone: '010-1111-2222',
      receiverName: '통합테스트 수령자',
      receiverPhone: '010-3333-4444',
      zipcode: '12345',
      address1: '서울 성동구 테스트로 1',
      address2: '101호',
    });
    expect(order?.deposit).toMatchObject({
      expectedAmount: 27000,
      depositStatus: DepositStatus.WAITING,
    });
  });

  async function createOrderFixture() {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const category = await prisma.category.create({
      data: {
        name: `${TEST_PREFIX} category ${suffix}`,
        slug: `test-store-integration-category-${suffix}`,
        isVisible: true,
      },
    });
    createdCategoryIds.push(category.id);

    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        name: `${TEST_PREFIX} product ${suffix}`,
        slug: `test-store-integration-product-${suffix}`,
        shortDescription: '통합 테스트 상품',
        description: '통합 테스트 상품 설명',
        basePrice: 10000,
        discountRate: 10,
        isVisible: true,
        isSoldOut: false,
        consultationRequired: false,
      },
    });
    createdProductIds.push(product.id);

    await prisma.productImage.create({
      data: {
        productId: product.id,
        imageType: ProductImageType.THUMBNAIL,
        imageUrl: 'https://example.test/product-thumbnail.jpg',
        sortOrder: 0,
      },
    });

    const optionGroup = await prisma.productOptionGroup.create({
      data: {
        productId: product.id,
        name: '포장',
        selectionType: ProductOptionSelectionType.QUANTITY,
        isRequired: true,
        isActive: true,
        sortOrder: 0,
      },
    });

    const option = await prisma.productOption.create({
      data: {
        optionGroupId: optionGroup.id,
        name: '선물 포장',
        extraPrice: 1500,
        maxQuantity: 3,
        isActive: true,
        sortOrder: 0,
      },
    });

    return {
      category,
      product,
      optionGroup,
      option,
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
