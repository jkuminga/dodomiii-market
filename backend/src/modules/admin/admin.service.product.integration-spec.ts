import {
  PrismaClient,
  ProductImageType,
  ProductOptionSelectionType,
} from '@prisma/client';
import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';

import { AdminService } from './admin.service';

const TEST_PREFIX = '[TEST] AdminService product integration';

jest.setTimeout(30_000);

describe('AdminService product integration', () => {
  const prisma = new PrismaClient();
  const storeCache = {
    getOrSet: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    invalidate: jest.fn(),
    invalidateByPrefix: jest.fn(),
  };
  const service = new AdminService(prisma as never, storeCache as never);
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

  it('creates a product with images, option groups, options, and cache invalidation', async () => {
    const category = await createCategoryFixture();
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const result = await service.createProduct({
      categoryId: Number(category.id),
      name: `${TEST_PREFIX} product ${suffix}`,
      slug: `test-admin-product-${suffix}`,
      shortDescription: '통합 테스트 상품 요약',
      description: '통합 테스트 상품 설명',
      basePrice: 15000,
      discountRate: 20,
      isVisible: true,
      isSoldOut: false,
      consultationRequired: false,
      images: [
        {
          imageType: ProductImageType.DETAIL,
          imageUrl: 'https://example.test/detail.jpg',
        },
        {
          imageType: ProductImageType.THUMBNAIL,
          imageUrl: 'https://example.test/thumb.jpg',
          sortOrder: 10,
        },
      ],
      optionGroups: [
        {
          name: '포장',
          selectionType: ProductOptionSelectionType.SINGLE,
          isRequired: true,
          options: [
            {
              name: '기본 포장',
            },
            {
              name: '선물 포장',
              extraPrice: 3000,
              maxQuantity: 2,
              isActive: false,
              sortOrder: 8,
            },
          ],
        },
        {
          name: '추가 구성',
          selectionType: ProductOptionSelectionType.QUANTITY,
          isActive: false,
          sortOrder: 5,
          options: [
            {
              name: '엽서',
              extraPrice: 500,
              maxQuantity: 5,
            },
          ],
        },
      ],
    });
    createdProductIds.push(BigInt(result.id));

    expect(result).toMatchObject({
      category: {
        id: Number(category.id),
        name: category.name,
        slug: category.slug,
        parentId: null,
        isVisible: true,
      },
      shortDescription: '통합 테스트 상품 요약',
      description: '통합 테스트 상품 설명',
      basePrice: 15000,
      discountRate: 20,
      isVisible: true,
      isSoldOut: false,
      consultationRequired: false,
      orderItemCount: 0,
      deletedAt: null,
    });
    expect(result.images).toMatchObject([
      {
        imageType: ProductImageType.DETAIL,
        imageUrl: 'https://example.test/detail.jpg',
        sortOrder: 0,
      },
      {
        imageType: ProductImageType.THUMBNAIL,
        imageUrl: 'https://example.test/thumb.jpg',
        sortOrder: 10,
      },
    ]);
    expect(result.optionGroups).toMatchObject([
      {
        name: '포장',
        selectionType: ProductOptionSelectionType.SINGLE,
        isRequired: true,
        isActive: true,
        sortOrder: 0,
        options: [
          {
            name: '기본 포장',
            extraPrice: 0,
            maxQuantity: null,
            isActive: true,
            sortOrder: 0,
          },
          {
            name: '선물 포장',
            extraPrice: 3000,
            maxQuantity: 2,
            isActive: false,
            sortOrder: 8,
          },
        ],
      },
      {
        name: '추가 구성',
        selectionType: ProductOptionSelectionType.QUANTITY,
        isRequired: false,
        isActive: false,
        sortOrder: 5,
        options: [
          {
            name: '엽서',
            extraPrice: 500,
            maxQuantity: 5,
            isActive: true,
            sortOrder: 0,
          },
        ],
      },
    ]);
    expect(storeCache.invalidateByPrefix).toHaveBeenCalledWith('store:products:');
    expect(storeCache.invalidateByPrefix).toHaveBeenCalledWith('store:product-detail:');

    const product = await prisma.product.findUnique({
      where: { id: BigInt(result.id) },
      include: {
        images: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        },
        optionGroups: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: {
            options: {
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            },
          },
        },
      },
    });

    expect(product).toMatchObject({
      categoryId: category.id,
      name: result.name,
      slug: result.slug,
      basePrice: 15000,
      discountRate: 20,
      isVisible: true,
      isSoldOut: false,
      consultationRequired: false,
    });
    expect(product?.images).toMatchObject([
      {
        imageType: ProductImageType.DETAIL,
        imageUrl: 'https://example.test/detail.jpg',
        sortOrder: 0,
      },
      {
        imageType: ProductImageType.THUMBNAIL,
        imageUrl: 'https://example.test/thumb.jpg',
        sortOrder: 10,
      },
    ]);
    expect(product?.optionGroups).toMatchObject([
      {
        name: '포장',
        selectionType: ProductOptionSelectionType.SINGLE,
        isRequired: true,
        isActive: true,
        sortOrder: 0,
        options: [
          {
            name: '기본 포장',
            extraPrice: 0,
            maxQuantity: null,
            isActive: true,
            sortOrder: 0,
          },
          {
            name: '선물 포장',
            extraPrice: 3000,
            maxQuantity: 2,
            isActive: false,
            sortOrder: 8,
          },
        ],
      },
      {
        name: '추가 구성',
        selectionType: ProductOptionSelectionType.QUANTITY,
        isRequired: false,
        isActive: false,
        sortOrder: 5,
        options: [
          {
            name: '엽서',
            extraPrice: 500,
            maxQuantity: 5,
            isActive: true,
            sortOrder: 0,
          },
        ],
      },
    ]);
  });

  async function createCategoryFixture() {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const category = await prisma.category.create({
      data: {
        name: `${TEST_PREFIX} category ${suffix}`,
        slug: `test-admin-product-category-${suffix}`,
        isVisible: true,
      },
    });
    createdCategoryIds.push(category.id);

    return category;
  }

  async function cleanupCreatedRows() {
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
