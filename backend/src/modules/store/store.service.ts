import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { GetProductsQueryDto } from './dto/get-products.query.dto';

export type CategoryTreeNode = {
  id: number;
  parentId: number | null;
  name: string;
  slug: string;
  sortOrder: number;
  children: CategoryTreeNode[];
};

@Injectable()
export class StoreService {
  constructor(private readonly prisma: PrismaService) {}

  async getVisibleCategories() {
    const categories = await this.prisma.category.findMany({
      where: { isVisible: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        parentId: true,
        name: true,
        slug: true,
        sortOrder: true,
      },
    });

    const map = new Map<string, CategoryTreeNode>();
    const roots: CategoryTreeNode[] = [];

    for (const category of categories) {
      const node: CategoryTreeNode = {
        id: Number(category.id),
        parentId: category.parentId ? Number(category.parentId) : null,
        name: category.name,
        slug: category.slug,
        sortOrder: category.sortOrder,
        children: [],
      };

      map.set(category.id.toString(), node);
    }

    for (const category of categories) {
      const node = map.get(category.id.toString());
      if (!node) {
        continue;
      }

      if (!category.parentId) {
        roots.push(node);
        continue;
      }

      const parent = map.get(category.parentId.toString());
      if (!parent) {
        roots.push(node);
        continue;
      }

      parent.children.push(node);
    }

    return { items: roots };
  }

  async getVisibleProducts(query: GetProductsQueryDto) {
    const page = query.page ?? 1;
    const size = query.size ?? 20;

    const where: Prisma.ProductWhereInput = {
      isVisible: true,
      deletedAt: null,
    };

    if (query.q) {
      where.name = {
        contains: query.q,
        mode: 'insensitive',
      };
    }

    if (query.categorySlug) {
      const category = await this.prisma.category.findFirst({
        where: {
          slug: query.categorySlug,
          isVisible: true,
        },
        select: { id: true },
      });

      if (!category) {
        return {
          items: [],
          meta: {
            page,
            size,
            totalItems: 0,
            totalPages: 0,
          },
        };
      }

      where.categoryId = category.id;
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput[] =
      query.sort === 'price_asc'
        ? [{ basePrice: 'asc' }, { id: 'desc' }]
        : query.sort === 'price_desc'
          ? [{ basePrice: 'desc' }, { id: 'desc' }]
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
            },
          },
          images: {
            where: { imageType: 'THUMBNAIL' },
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            take: 1,
            select: {
              imageUrl: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(totalItems / size);

    return {
      items: products.map((product) => ({
        id: Number(product.id),
        categoryId: Number(product.categoryId),
        categoryName: product.category.name,
        name: product.name,
        slug: product.slug,
        shortDescription: product.shortDescription,
        basePrice: product.basePrice,
        isSoldOut: product.isSoldOut,
        consultationRequired: product.consultationRequired,
        thumbnailImageUrl: product.images[0]?.imageUrl ?? null,
      })),
      meta: {
        page,
        size,
        totalItems,
        totalPages,
      },
    };
  }

  async getVisibleProductById(productId: string) {
    const parsedId = Number(productId);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: '상품을 찾을 수 없습니다.',
      });
    }

    const product = await this.prisma.product.findFirst({
      where: {
        id: BigInt(parsedId),
        isVisible: true,
        deletedAt: null,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        images: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            imageType: true,
            imageUrl: true,
            sortOrder: true,
          },
        },
        options: {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            optionGroupName: true,
            optionValue: true,
            extraPrice: true,
            isActive: true,
            sortOrder: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: '상품을 찾을 수 없습니다.',
      });
    }

    return {
      id: Number(product.id),
      categoryId: Number(product.categoryId),
      categoryName: product.category.name,
      name: product.name,
      slug: product.slug,
      shortDescription: product.shortDescription,
      description: product.description,
      basePrice: product.basePrice,
      isSoldOut: product.isSoldOut,
      consultationRequired: product.consultationRequired,
      stockQuantity: product.stockQuantity,
      images: product.images.map((image) => ({
        id: Number(image.id),
        imageType: image.imageType,
        imageUrl: image.imageUrl,
        sortOrder: image.sortOrder,
      })),
      options: product.options.map((option) => ({
        id: Number(option.id),
        optionGroupName: option.optionGroupName,
        optionValue: option.optionValue,
        extraPrice: option.extraPrice,
        isActive: option.isActive,
        sortOrder: option.sortOrder,
      })),
      policy: {
        shippingInfo: '주문 후 제작이 시작되며 지역/재고 상황에 따라 배송일이 달라질 수 있습니다.',
        refundInfo: '핸드메이드 특성상 단순 변심 반품이 제한될 수 있으니 주문 전 옵션을 확인해주세요.',
      },
    };
  }
}
