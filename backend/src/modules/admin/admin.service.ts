import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductImageType } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { StoreCacheService } from '../store/store-cache.service';
import type {
  AdminCategoryResponse,
  AdminHomeHeroResponse,
  AdminHomePopupResponse,
  AdminProductDetailResponse,
  AdminProductListItemResponse,
} from './admin.types';
import { UpdateAdminHomeHeroDto } from './dto/update-admin-home-hero.dto';
import { CreateAdminCategoryDto } from './dto/create-admin-category.dto';
import { UpdateAdminHomePopupDto } from './dto/update-admin-home-popup.dto';
import { CreateAdminProductDto } from './dto/create-admin-product.dto';
import { GetAdminProductsQueryDto } from './dto/get-admin-products.query.dto';
import { UpdateAdminCategoryDto } from './dto/update-admin-category.dto';
import { UpdateAdminProductDto } from './dto/update-admin-product.dto';

const adminProductDetailArgs = Prisma.validator<Prisma.ProductDefaultArgs>()({
  include: {
    category: {
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        isVisible: true,
      },
    },
    images: {
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        imageType: true,
        imageUrl: true,
        sortOrder: true,
        createdAt: true,
      },
    },
    optionGroups: {
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: {
        options: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            name: true,
            extraPrice: true,
            maxQuantity: true,
            isActive: true,
            sortOrder: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    },
    _count: {
      select: {
        orderItems: true,
      },
    },
  },
});

type AdminProductDetailRecord = Prisma.ProductGetPayload<typeof adminProductDetailArgs>;

type CategoryNode = {
  id: bigint;
  parentId: bigint | null;
  name: string;
};

const CATEGORY_LANDING_SELECTION_LIMIT = 3;

function extractGroupedCount(
  count: true | { id?: number } | undefined,
): number {
  if (!count || count === true) {
    return 0;
  }

  return count.id ?? 0;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeCache: StoreCacheService,
  ) {}

  async getLatestHomePopup(): Promise<AdminHomePopupResponse | null> {
    const popup = await this.prisma.homePopup.findFirst({
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });

    return popup ? this.mapHomePopup(popup) : null;
  }

  async getHomeHero(): Promise<AdminHomeHeroResponse | null> {
    const hero = await this.prisma.homeHeroSetting.findUnique({
      where: { key: 'default' },
    });

    return hero ? this.mapHomeHero(hero) : null;
  }

  async upsertHomePopup(dto: UpdateAdminHomePopupDto): Promise<AdminHomePopupResponse> {
    const popupId = dto.popupId ? BigInt(dto.popupId) : null;

    const result = await this.prisma.$transaction(async (tx) => {
      const isActive = dto.isActive ?? true;

      if (isActive) {
        await tx.homePopup.updateMany({
          where: popupId
            ? {
                isActive: true,
                id: {
                  not: popupId,
                },
              }
            : {
                isActive: true,
              },
          data: {
            isActive: false,
          },
        });
      }

      if (popupId) {
        const existing = await tx.homePopup.findUnique({
          where: { id: popupId },
          select: { id: true },
        });

        if (!existing) {
          throw new NotFoundException({
            code: 'HOME_POPUP_NOT_FOUND',
            message: '홈 팝업을 찾을 수 없습니다.',
          });
        }

        const updated = await tx.homePopup.update({
          where: { id: popupId },
          data: {
            title: dto.title?.trim() || null,
            imageUrl: dto.imageUrl.trim(),
            linkUrl: dto.linkUrl?.trim() || null,
            isActive,
          },
        });

        return this.mapHomePopup(updated);
      }

      const created = await tx.homePopup.create({
        data: {
          title: dto.title?.trim() || null,
          imageUrl: dto.imageUrl.trim(),
          linkUrl: dto.linkUrl?.trim() || null,
          isActive,
        },
      });

      return this.mapHomePopup(created);
    });

    this.storeCache.invalidateByPrefix('store:home-popup:');
    return result;
  }

  async upsertHomeHero(dto: UpdateAdminHomeHeroDto): Promise<AdminHomeHeroResponse> {
    const result = await this.prisma.homeHeroSetting.upsert({
      where: { key: 'default' },
      create: {
        key: 'default',
        imageUrl: dto.imageUrl.trim(),
      },
      update: {
        imageUrl: dto.imageUrl.trim(),
      },
    });

    this.storeCache.invalidateByPrefix('store:home-hero:');
    return this.mapHomeHero(result);
  }

  async createCategory(dto: CreateAdminCategoryDto): Promise<AdminCategoryResponse> {
    try {
      const categoryId = await this.prisma.$transaction(async (tx) => {
        if (dto.isOnLandingPage) {
          await this.assertLandingCategorySlotAvailable(tx);
        }

        await this.assertCategorySlugAvailable(tx, dto.slug);

        const parentId = dto.parentId == null ? null : BigInt(dto.parentId);
        if (parentId) {
          await this.assertCategoryExists(tx, parentId);
        }

        const category = await tx.category.create({
          data: {
            parentId,
            name: dto.name,
            slug: dto.slug,
            imageUrl: dto.imageUrl?.trim() || null,
            isOnLandingPage: dto.isOnLandingPage ?? false,
            sortOrder: dto.sortOrder ?? 0,
            isVisible: dto.isVisible ?? true,
          },
          select: {
            id: true,
          },
        });

        return category.id;
      });

      this.storeCache.invalidateByPrefix('store:categories:');
      this.storeCache.invalidateByPrefix('store:products:');
      this.storeCache.invalidateByPrefix('store:product-detail:');
      return this.getCategoryById(categoryId);
    } catch (error) {
      this.handleCategoryWriteError(error);
    }
  }

  async getCategories() {
    const [categories, totalProductCounts, activeProductCounts] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: {
          parent: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              children: true,
            },
          },
        },
      }),
      this.prisma.product.groupBy({
        by: ['categoryId'],
        orderBy: {
          categoryId: 'asc',
        },
        _count: {
          id: true,
        },
      }),
      this.prisma.product.groupBy({
        by: ['categoryId'],
        orderBy: {
          categoryId: 'asc',
        },
        where: {
          deletedAt: null,
        },
        _count: {
          id: true,
        },
      }),
    ]);

    const categoryMap = new Map<string, CategoryNode>(
      categories.map((category) => [
        category.id.toString(),
        {
          id: category.id,
          parentId: category.parentId,
          name: category.name,
        },
      ]),
    );
    const totalProductCountMap = new Map<string, number>(
      totalProductCounts.map((row) => [row.categoryId.toString(), extractGroupedCount(row._count)]),
    );
    const activeProductCountMap = new Map<string, number>(
      activeProductCounts.map((row) => [row.categoryId.toString(), extractGroupedCount(row._count)]),
    );

    return {
      items: categories.map((category) => {
        const totalProductCount = totalProductCountMap.get(category.id.toString()) ?? 0;
        const activeProductCount = activeProductCountMap.get(category.id.toString()) ?? 0;

        return this.mapCategory(categoryMap, {
          id: category.id,
          parentId: category.parentId,
          name: category.name,
          slug: category.slug,
          imageUrl: category.imageUrl,
          isOnLandingPage: category.isOnLandingPage,
          sortOrder: category.sortOrder,
          isVisible: category.isVisible,
          createdAt: category.createdAt,
          updatedAt: category.updatedAt,
          parentName: category.parent?.name ?? null,
          childCount: category._count.children,
          totalProductCount,
          activeProductCount,
        });
      }),
    };
  }

  async updateCategory(
    categoryId: number,
    dto: UpdateAdminCategoryDto,
  ): Promise<AdminCategoryResponse> {
    try {
      const categoryRecordId = await this.prisma.$transaction(async (tx) => {
        const existingCategory = await tx.category.findUnique({
          where: { id: BigInt(categoryId) },
          select: {
            id: true,
            parentId: true,
            slug: true,
            isOnLandingPage: true,
          },
        });

        if (!existingCategory) {
          throw new NotFoundException({
            code: 'CATEGORY_NOT_FOUND',
            message: '카테고리를 찾을 수 없습니다.',
          });
        }

        if (dto.slug !== undefined) {
          await this.assertCategorySlugAvailable(tx, dto.slug, existingCategory.id);
        }

        if (dto.parentId !== undefined) {
          await this.assertCategoryParentAssignable(
            tx,
            existingCategory.id,
            dto.parentId == null ? null : BigInt(dto.parentId),
          );
        }

        if (dto.isOnLandingPage === true && !existingCategory.isOnLandingPage) {
          await this.assertLandingCategorySlotAvailable(tx);
        }

        const updatedCategory = await tx.category.update({
          where: { id: existingCategory.id },
          data: {
            parentId:
              dto.parentId !== undefined ? (dto.parentId == null ? null : BigInt(dto.parentId)) : undefined,
            name: dto.name,
            slug: dto.slug,
            imageUrl: dto.imageUrl !== undefined ? dto.imageUrl?.trim() || null : undefined,
            isOnLandingPage: dto.isOnLandingPage,
            sortOrder: dto.sortOrder,
            isVisible: dto.isVisible,
          },
          select: {
            id: true,
          },
        });

        return updatedCategory.id;
      });

      this.storeCache.invalidateByPrefix('store:categories:');
      this.storeCache.invalidateByPrefix('store:products:');
      this.storeCache.invalidateByPrefix('store:product-detail:');
      return this.getCategoryById(categoryRecordId);
    } catch (error) {
      this.handleCategoryWriteError(error);
    }
  }

  async deleteCategory(categoryId: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingCategory = await tx.category.findUnique({
          where: { id: BigInt(categoryId) },
          select: {
            id: true,
          },
        });

        if (!existingCategory) {
          throw new NotFoundException({
            code: 'CATEGORY_NOT_FOUND',
            message: '카테고리를 찾을 수 없습니다.',
          });
        }

        const [childCount, productCount] = await Promise.all([
          tx.category.count({
            where: {
              parentId: existingCategory.id,
            },
          }),
          tx.product.count({
            where: {
              categoryId: existingCategory.id,
            },
          }),
        ]);

        if (childCount > 0) {
          throw new ConflictException({
            code: 'CATEGORY_DELETE_BLOCKED',
            message: '하위 카테고리가 있어 삭제할 수 없습니다.',
          });
        }

        if (productCount > 0) {
          throw new ConflictException({
            code: 'CATEGORY_DELETE_BLOCKED',
            message: '연결된 상품이 있어 삭제할 수 없습니다.',
          });
        }

        await tx.category.delete({
          where: {
            id: existingCategory.id,
          },
        });

        const result = {
          categoryId: Number(existingCategory.id),
          deleted: true,
        };

        this.storeCache.invalidateByPrefix('store:categories:');
        this.storeCache.invalidateByPrefix('store:products:');
        this.storeCache.invalidateByPrefix('store:product-detail:');
        return result;
      });
    } catch (error) {
      this.handleCategoryDeleteError(error);
    }
  }

  async createProduct(dto: CreateAdminProductDto): Promise<AdminProductDetailResponse> {
    try {
      const productId = await this.prisma.$transaction(async (tx) => {
        await this.assertCategoryExists(tx, BigInt(dto.categoryId));

        const product = await tx.product.create({
          data: {
            categoryId: BigInt(dto.categoryId),
            name: dto.name,
            slug: dto.slug,
            shortDescription: dto.shortDescription ?? null,
            description: dto.description ?? null,
            basePrice: dto.basePrice,
            isVisible: dto.isVisible ?? true,
            isSoldOut: dto.isSoldOut ?? false,
            consultationRequired: dto.consultationRequired ?? true,
            stockQuantity: dto.stockQuantity ?? null,
          },
          select: {
            id: true,
          },
        });

        if (dto.images?.length) {
          await tx.productImage.createMany({
            data: dto.images.map((image, index) => ({
              productId: product.id,
              imageType: image.imageType,
              imageUrl: image.imageUrl,
              sortOrder: image.sortOrder ?? index,
            })),
          });
        }

        if (dto.optionGroups?.length) {
          await this.replaceProductOptionGroups(tx, product.id, dto.optionGroups);
        }

        return product.id;
      });

      this.storeCache.invalidateByPrefix('store:products:');
      this.storeCache.invalidateByPrefix('store:product-detail:');
      return this.getProductById(BigInt(productId));
    } catch (error) {
      this.handleProductWriteError(error);
    }
  }

  async getProducts(query: GetAdminProductsQueryDto) {
    const page = query.page ?? 1;
    const size = query.size ?? 20;

    const where: Prisma.ProductWhereInput = {};

    if (query.q) {
      where.OR = [
        {
          name: {
            contains: query.q,
            mode: 'insensitive',
          },
        },
        {
          slug: {
            contains: query.q,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (query.categoryId !== undefined) {
      where.categoryId = BigInt(query.categoryId);
    }

    if (query.isVisible !== undefined) {
      where.isVisible = query.isVisible;
    }

    if (query.isSoldOut !== undefined) {
      where.isSoldOut = query.isSoldOut;
    }

    if ((query.deletedStatus ?? 'active') === 'active') {
      where.deletedAt = null;
    } else if (query.deletedStatus === 'deleted') {
      where.deletedAt = {
        not: null,
      };
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput[] =
      query.sort === 'price_asc'
        ? [{ basePrice: 'asc' }, { id: 'desc' }]
        : query.sort === 'price_desc'
          ? [{ basePrice: 'desc' }, { id: 'desc' }]
          : query.sort === 'oldest'
            ? [{ createdAt: 'asc' }, { id: 'asc' }]
            : query.sort === 'updated_desc'
              ? [{ updatedAt: 'desc' }, { id: 'desc' }]
              : [{ createdAt: 'desc' }, { id: 'desc' }];

    const [totalItems, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * size,
        take: size,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          images: {
            where: { imageType: ProductImageType.THUMBNAIL },
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            take: 1,
            select: {
              imageUrl: true,
            },
          },
          optionGroups: {
            select: {
              options: {
                select: {
                  id: true,
                },
              },
            },
          },
          _count: {
            select: {
              images: true,
              orderItems: true,
            },
          },
        },
      }),
    ]);

    return {
      items: products.map((product): AdminProductListItemResponse => ({
        id: Number(product.id),
        categoryId: Number(product.categoryId),
        categoryName: product.category.name,
        categorySlug: product.category.slug,
        name: product.name,
        slug: product.slug,
        shortDescription: product.shortDescription,
        basePrice: product.basePrice,
        isVisible: product.isVisible,
        isSoldOut: product.isSoldOut,
        consultationRequired: product.consultationRequired,
        stockQuantity: product.stockQuantity,
        thumbnailImageUrl: product.images[0]?.imageUrl ?? null,
        imageCount: product._count.images,
        optionCount: product.optionGroups.reduce((sum, group) => sum + group.options.length, 0),
        orderItemCount: product._count.orderItems,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
        deletedAt: product.deletedAt?.toISOString() ?? null,
      })),
      meta: {
        page,
        size,
        totalItems,
        totalPages: Math.ceil(totalItems / size),
      },
    };
  }

  async getProduct(productId: number): Promise<AdminProductDetailResponse> {
    return this.getProductById(BigInt(productId));
  }

  async updateProduct(
    productId: number,
    dto: UpdateAdminProductDto,
  ): Promise<AdminProductDetailResponse> {
    try {
      const updatedProductId = await this.prisma.$transaction(async (tx) => {
        const existingProduct = await tx.product.findUnique({
          where: { id: BigInt(productId) },
          select: {
            id: true,
          },
        });

        if (!existingProduct) {
          throw new NotFoundException({
            code: 'PRODUCT_NOT_FOUND',
            message: '상품을 찾을 수 없습니다.',
          });
        }

        if (dto.categoryId !== undefined) {
          await this.assertCategoryExists(tx, BigInt(dto.categoryId));
        }

        await tx.product.update({
          where: { id: existingProduct.id },
          data: {
            categoryId: dto.categoryId !== undefined ? BigInt(dto.categoryId) : undefined,
            name: dto.name,
            slug: dto.slug,
            shortDescription:
              dto.shortDescription !== undefined ? (dto.shortDescription ?? null) : undefined,
            description: dto.description !== undefined ? (dto.description ?? null) : undefined,
            basePrice: dto.basePrice,
            isVisible: dto.isVisible,
            isSoldOut: dto.isSoldOut,
            consultationRequired: dto.consultationRequired,
            stockQuantity: dto.stockQuantity !== undefined ? (dto.stockQuantity ?? null) : undefined,
          },
        });

        if (dto.images !== undefined) {
          await tx.productImage.deleteMany({
            where: {
              productId: existingProduct.id,
            },
          });

          if (dto.images.length > 0) {
            await tx.productImage.createMany({
              data: dto.images.map((image, index) => ({
                productId: existingProduct.id,
                imageType: image.imageType,
                imageUrl: image.imageUrl,
                sortOrder: image.sortOrder ?? index,
              })),
            });
          }
        }

        if (dto.optionGroups !== undefined) {
          await this.replaceProductOptionGroups(tx, existingProduct.id, dto.optionGroups);
        }

        return existingProduct.id;
      });

      this.storeCache.invalidateByPrefix('store:products:');
      this.storeCache.invalidateByPrefix('store:product-detail:');
      return this.getProductById(updatedProductId);
    } catch (error) {
      this.handleProductWriteError(error);
    }
  }

  async deleteProduct(productId: number) {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: BigInt(productId) },
        select: {
          id: true,
          deletedAt: true,
        },
      });

      if (!product) {
        throw new NotFoundException({
          code: 'PRODUCT_NOT_FOUND',
          message: '상품을 찾을 수 없습니다.',
        });
      }

      const deletedAt = product.deletedAt ?? new Date();

      await this.prisma.product.update({
        where: { id: product.id },
        data: {
          isVisible: false,
          deletedAt,
        },
      });

      this.storeCache.invalidateByPrefix('store:products:');
      this.storeCache.invalidateByPrefix('store:product-detail:');
      return {
        productId: Number(product.id),
        deleted: true,
        deletedAt: deletedAt.toISOString(),
      };
    } catch (error) {
      this.handleProductDeleteError(error);
    }
  }

  private async getCategoryById(categoryId: bigint): Promise<AdminCategoryResponse> {
    const [category, totalProductCount, activeProductCount, categoryNodes] = await this.prisma.$transaction([
      this.prisma.category.findUnique({
        where: { id: categoryId },
        include: {
          parent: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              children: true,
            },
          },
        },
      }),
      this.prisma.product.count({
        where: {
          categoryId,
        },
      }),
      this.prisma.product.count({
        where: {
          categoryId,
          deletedAt: null,
        },
      }),
      this.prisma.category.findMany({
        select: {
          id: true,
          parentId: true,
          name: true,
        },
      }),
    ]);

    if (!category) {
      throw new NotFoundException({
        code: 'CATEGORY_NOT_FOUND',
        message: '카테고리를 찾을 수 없습니다.',
      });
    }

    const categoryMap = new Map<string, CategoryNode>(
      categoryNodes.map((node) => [
        node.id.toString(),
        {
          id: node.id,
          parentId: node.parentId,
          name: node.name,
        },
      ]),
    );

    return this.mapCategory(categoryMap, {
      id: category.id,
      parentId: category.parentId,
      name: category.name,
      slug: category.slug,
      imageUrl: category.imageUrl,
      isOnLandingPage: category.isOnLandingPage,
      sortOrder: category.sortOrder,
      isVisible: category.isVisible,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      parentName: category.parent?.name ?? null,
      childCount: category._count.children,
      totalProductCount,
      activeProductCount,
    });
  }

  private mapCategory(
    categoryMap: Map<string, CategoryNode>,
    category: {
      id: bigint;
      parentId: bigint | null;
      name: string;
      slug: string;
      imageUrl: string | null;
      isOnLandingPage: boolean;
      sortOrder: number;
      isVisible: boolean;
      createdAt: Date;
      updatedAt: Date;
      parentName: string | null;
      childCount: number;
      totalProductCount: number;
      activeProductCount: number;
    },
  ): AdminCategoryResponse {
    const pathSegments: string[] = [];
    let depth = 0;
    let currentParentId = category.parentId;

    pathSegments.unshift(category.name);

    while (currentParentId) {
      const parent = categoryMap.get(currentParentId.toString());
      if (!parent) {
        break;
      }

      pathSegments.unshift(parent.name);
      depth += 1;
      currentParentId = parent.parentId;
    }

    return {
      id: Number(category.id),
      parentId: category.parentId ? Number(category.parentId) : null,
      parentName: category.parentName,
      name: category.name,
      slug: category.slug,
      imageUrl: category.imageUrl,
      isOnLandingPage: category.isOnLandingPage,
      depth,
      path: pathSegments.join(' > '),
      sortOrder: category.sortOrder,
      isVisible: category.isVisible,
      childCount: category.childCount,
      totalProductCount: category.totalProductCount,
      activeProductCount: category.activeProductCount,
      deletedProductCount: category.totalProductCount - category.activeProductCount,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    };
  }

  private async getProductById(productId: bigint): Promise<AdminProductDetailResponse> {
    const product = await this.findProductByIdOrThrow(this.prisma, productId);

    return this.mapProductDetail(product);
  }

  private async findProductByIdOrThrow(
    tx: PrismaService | Prisma.TransactionClient,
    productId: bigint,
  ): Promise<AdminProductDetailRecord> {
    const product = await tx.product.findUnique({
      where: { id: productId },
      ...adminProductDetailArgs,
    });

    if (!product) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: '상품을 찾을 수 없습니다.',
      });
    }

    return product;
  }

  private mapProductDetail(product: AdminProductDetailRecord): AdminProductDetailResponse {
    return {
      id: Number(product.id),
      category: {
        id: Number(product.category.id),
        name: product.category.name,
        slug: product.category.slug,
        parentId: product.category.parentId ? Number(product.category.parentId) : null,
        isVisible: product.category.isVisible,
      },
      name: product.name,
      slug: product.slug,
      shortDescription: product.shortDescription,
      description: product.description,
      basePrice: product.basePrice,
      isVisible: product.isVisible,
      isSoldOut: product.isSoldOut,
      consultationRequired: product.consultationRequired,
      stockQuantity: product.stockQuantity,
      images: product.images.map((image) => ({
        id: Number(image.id),
        imageType: image.imageType,
        imageUrl: image.imageUrl,
        sortOrder: image.sortOrder,
        createdAt: image.createdAt.toISOString(),
      })),
      optionGroups: product.optionGroups.map((group) => ({
        id: Number(group.id),
        name: group.name,
        selectionType: group.selectionType,
        isRequired: group.isRequired,
        isActive: group.isActive,
        sortOrder: group.sortOrder,
        createdAt: group.createdAt.toISOString(),
        updatedAt: group.updatedAt.toISOString(),
        options: group.options.map((option) => ({
          id: Number(option.id),
          name: option.name,
          extraPrice: option.extraPrice,
          maxQuantity: option.maxQuantity,
          isActive: option.isActive,
          sortOrder: option.sortOrder,
          createdAt: option.createdAt.toISOString(),
          updatedAt: option.updatedAt.toISOString(),
        })),
      })),
      orderItemCount: product._count.orderItems,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      deletedAt: product.deletedAt?.toISOString() ?? null,
    };
  }

  private async replaceProductOptionGroups(
    tx: Prisma.TransactionClient,
    productId: bigint,
    optionGroups: NonNullable<CreateAdminProductDto['optionGroups'] | UpdateAdminProductDto['optionGroups']>,
  ): Promise<void> {
    await tx.productOptionGroup.deleteMany({
      where: {
        productId,
      },
    });

    for (const [groupIndex, group] of optionGroups.entries()) {
      const createdGroup = await tx.productOptionGroup.create({
        data: {
          productId,
          name: group.name,
          selectionType: group.selectionType,
          isRequired: group.isRequired ?? false,
          isActive: group.isActive ?? true,
          sortOrder: group.sortOrder ?? groupIndex,
        },
        select: {
          id: true,
        },
      });

      if (group.options.length > 0) {
        await tx.productOption.createMany({
          data: group.options.map((option, optionIndex) => ({
            optionGroupId: createdGroup.id,
            name: option.name,
            extraPrice: option.extraPrice ?? 0,
            maxQuantity: option.maxQuantity ?? null,
            isActive: option.isActive ?? true,
            sortOrder: option.sortOrder ?? optionIndex,
          })),
        });
      }
    }
  }

  private async assertCategoryExists(
    tx: Prisma.TransactionClient,
    categoryId: bigint,
  ): Promise<void> {
    const category = await tx.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException({
        code: 'CATEGORY_NOT_FOUND',
        message: '카테고리를 찾을 수 없습니다.',
      });
    }
  }

  private async assertCategorySlugAvailable(
    tx: Prisma.TransactionClient,
    slug: string,
    excludeCategoryId?: bigint,
  ): Promise<void> {
    const existingCategory = await tx.category.findFirst({
      where: {
        slug,
        id: excludeCategoryId
          ? {
              not: excludeCategoryId,
            }
          : undefined,
      },
      select: {
        id: true,
      },
    });

    if (existingCategory) {
      throw new ConflictException({
        code: 'CATEGORY_CONFLICT',
        message: '이미 사용 중인 카테고리 슬러그입니다.',
      });
    }
  }

  private async assertLandingCategorySlotAvailable(tx: Prisma.TransactionClient): Promise<void> {
    const selectedCount = await tx.category.count({
      where: {
        isOnLandingPage: true,
      },
    });

    if (selectedCount >= CATEGORY_LANDING_SELECTION_LIMIT) {
      throw new ConflictException({
        code: 'CATEGORY_LANDING_LIMIT_EXCEEDED',
        message: `랜딩 페이지 카테고리는 최대 ${CATEGORY_LANDING_SELECTION_LIMIT}개까지 노출할 수 있습니다.`,
      });
    }
  }

  private async assertCategoryParentAssignable(
    tx: Prisma.TransactionClient,
    categoryId: bigint,
    parentId: bigint | null,
  ): Promise<void> {
    if (!parentId) {
      return;
    }

    if (parentId === categoryId) {
      throw new BadRequestException({
        code: 'CATEGORY_PARENT_INVALID',
        message: '자기 자신을 상위 카테고리로 지정할 수 없습니다.',
      });
    }

    const categories = await tx.category.findMany({
      select: {
        id: true,
        parentId: true,
      },
    });
    const parentMap = new Map<string, bigint | null>(
      categories.map((category) => [category.id.toString(), category.parentId]),
    );

    if (!parentMap.has(parentId.toString())) {
      throw new NotFoundException({
        code: 'CATEGORY_NOT_FOUND',
        message: '카테고리를 찾을 수 없습니다.',
      });
    }

    let currentParentId: bigint | null = parentId;
    while (currentParentId) {
      if (currentParentId === categoryId) {
        throw new BadRequestException({
          code: 'CATEGORY_PARENT_INVALID',
          message: '하위 카테고리를 상위 카테고리로 지정할 수 없습니다.',
        });
      }

      currentParentId = parentMap.get(currentParentId.toString()) ?? null;
    }
  }

  private handleCategoryWriteError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'CATEGORY_CONFLICT',
        message: '이미 사용 중인 카테고리입니다.',
      });
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundException({
        code: 'CATEGORY_NOT_FOUND',
        message: '카테고리를 찾을 수 없습니다.',
      });
    }

    throw error;
  }

  private handleCategoryDeleteError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw new ConflictException({
        code: 'CATEGORY_DELETE_BLOCKED',
        message: '연결된 데이터가 있어 카테고리를 삭제할 수 없습니다.',
      });
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundException({
        code: 'CATEGORY_NOT_FOUND',
        message: '카테고리를 찾을 수 없습니다.',
      });
    }

    throw error;
  }

  private handleProductWriteError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'PRODUCT_CONFLICT',
        message: '이미 사용 중인 상품 슬러그입니다.',
      });
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw new NotFoundException({
        code: 'CATEGORY_NOT_FOUND',
        message: '카테고리를 찾을 수 없습니다.',
      });
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: '상품을 찾을 수 없습니다.',
      });
    }

    throw error;
  }

  private handleProductDeleteError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: '상품을 찾을 수 없습니다.',
      });
    }

    throw error;
  }

  private mapHomePopup(popup: {
    id: bigint;
    title: string | null;
    imageUrl: string;
    linkUrl: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): AdminHomePopupResponse {
    return {
      id: Number(popup.id),
      title: popup.title,
      imageUrl: popup.imageUrl,
      linkUrl: popup.linkUrl,
      isActive: popup.isActive,
      createdAt: popup.createdAt.toISOString(),
      updatedAt: popup.updatedAt.toISOString(),
    };
  }

  private mapHomeHero(hero: {
    key: string;
    imageUrl: string;
    createdAt: Date;
    updatedAt: Date;
  }): AdminHomeHeroResponse {
    return {
      key: hero.key,
      imageUrl: hero.imageUrl,
      createdAt: hero.createdAt.toISOString(),
      updatedAt: hero.updatedAt.toISOString(),
    };
  }
}
