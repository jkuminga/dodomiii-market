import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { DepositStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { OrderNotificationsService } from '../notifications/order-notifications.service';
import { assertOrderStatusTransition } from '../orders/domain/order-status-transition';
import { CreateCustomCheckoutOrderDto } from './dto/create-custom-checkout-order.dto';
import { CreateDepositRequestDto } from './dto/create-deposit-request.dto';
import { CreateOrderContactDto, CreateOrderDto, CreateOrderItemDto } from './dto/create-order.dto';
import { GetProductsQueryDto } from './dto/get-products.query.dto';
import {
  StoreCustomCheckoutResponse,
  StoreDepositRequestResponse,
  StoreHomeHeroResponse,
  StoreHomePopupResponse,
  StorefrontSettingsResponse,
  StoreNoticeContentBlock,
  StoreNoticeDetailResponse,
  StoreNoticeListItemResponse,
  StoreOrderContact,
  StoreOrderDetailResponse,
  StoreOrderTrackingResponse,
} from './store.types';
import {
  assertCustomOrderLinkAvailable,
  buildCustomCheckoutUrl,
  getCustomOrderLinkAvailability,
  parseCustomOrderLinkExpiresAt,
} from './domain/custom-order-link';
import {
  formatOrderDate,
  getDepositDeadlineAt,
  toIsoString,
} from './domain/order-deadline';
import { buildDepositRequestReason, getDepositRequestDecision } from './domain/deposit-request';
import {
  buildCustomOrderPricing,
  buildOrderPricingFromItems,
  calculateDiscountedPrice,
  type OrderPricingSnapshot,
} from './domain/order-pricing';
import { buildTrackingEvents, getShipmentSnapshot } from './domain/order-tracking';
import { normalizeOrderContactAddress } from './utils/order-contact.util';
import { StoreCacheService } from './store-cache.service';

export type CategoryTreeNode = {
  id: number;
  parentId: number | null;
  name: string;
  slug: string;
  imageUrl: string | null;
  isOnLandingPage: boolean;
  sortOrder: number;
  children: CategoryTreeNode[];
};

type ResolvedOrderItem = {
  productId: bigint;
  productOptionId: bigint | null;
  productNameSnapshot: string;
  optionNameSnapshot: string | null;
  optionValueSnapshot: string | null;
  unitPrice: number;
  quantity: number;
  lineTotalPrice: number;
  selectedOptions: Array<{
    productOptionGroupId: bigint;
    productOptionId: bigint;
    groupNameSnapshot: string;
    optionNameSnapshot: string;
    extraPriceSnapshot: number;
    quantity: number;
  }>;
};

type DepositAccountInfo = {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
};

type StoreCreatedOrderItem = {
  productId: number;
  productOptionId: number | null;
  productNameSnapshot: string;
  optionNameSnapshot: string | null;
  optionValueSnapshot: string | null;
  unitPrice: number;
  quantity: number;
  lineTotalPrice: number;
  selectedOptions: Array<{
    productOptionGroupId: number;
    productOptionId: number;
    groupNameSnapshot: string;
    optionNameSnapshot: string;
    extraPriceSnapshot: number;
    quantity: number;
  }>;
};

type StoreCreatedOrderResponse = {
  orderId: number;
  orderNumber: string;
  orderStatus: string;
  items: StoreCreatedOrderItem[];
  contact: StoreOrderContact;
  pricing: OrderPricingSnapshot;
  depositInfo: {
    bankName: string;
    accountHolder: string;
    accountNumber: string;
    expectedAmount: number;
    depositStatus: DepositStatus;
    depositDeadlineAt: string;
  };
  createdAt: string;
};

type CustomOrderLinkCreateInput = {
  finalTotalPrice: number;
  shippingFee: number;
  note?: string;
  expiresAt: string;
};

type AdminCustomOrderLinkView = {
  linkId: number;
  token: string;
  checkoutUrl: string;
  productName: string;
  note: string | null;
  totalProductPrice: number;
  shippingFee: number;
  finalTotalPrice: number;
  isActive: boolean;
  isExpired: boolean;
  isAvailable: boolean;
  isUsed: boolean;
  usageCount: number;
  usedAt: string | null;
  usedOrderId: number | null;
  usedOrderNumber: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

const ORDER_NUMBER_PREFIX = 'DM';
const ORDER_NUMBER_RETRY_LIMIT = 3;
const CUSTOM_ORDER_LINK_RETRY_LIMIT = 5;
const ORDER_NUMBER_SEQUENCE_WIDTH = 4;
const CUSTOM_ORDER_PRODUCT_NAME = '커스텀 주문';
const CUSTOM_ORDER_TOKEN_PREFIX = 'cus_';
const CUSTOM_ORDER_TOKEN_BYTES = 24;
const STORE_CATEGORIES_CACHE_TTL_MS = 5 * 60 * 1000;
const STORE_HOME_POPUP_CACHE_TTL_MS = 30 * 1000;
const STORE_PRODUCTS_CACHE_TTL_MS = 20 * 1000;
const STORE_PRODUCT_DETAIL_CACHE_TTL_MS = 20 * 1000;
const STORE_NOTICE_CACHE_TTL_MS = 60 * 1000;

const storeOrderDetailArgs = Prisma.validator<Prisma.OrderDefaultArgs>()({
  select: {
    id: true,
    orderNumber: true,
    orderStatus: true,
    totalProductPrice: true,
    shippingFee: true,
    finalTotalPrice: true,
    customerRequest: true,
    depositDeadlineAt: true,
    createdAt: true,
    updatedAt: true,
    items: {
      orderBy: [{ id: 'asc' }],
      select: {
        productNameSnapshot: true,
        product: {
          select: {
            images: {
              where: { imageType: 'THUMBNAIL' },
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
              take: 1,
              select: {
                imageUrl: true,
              },
            },
          },
        },
        optionNameSnapshot: true,
        optionValueSnapshot: true,
        unitPrice: true,
        quantity: true,
        lineTotalPrice: true,
      },
    },
    contact: {
      select: {
        buyerName: true,
        buyerPhone: true,
        receiverName: true,
        receiverPhone: true,
        zipcode: true,
        address1: true,
        address2: true,
      },
    },
    deposit: {
      select: {
        bankName: true,
        accountHolder: true,
        accountNumber: true,
        expectedAmount: true,
        depositorName: true,
        requestedAt: true,
        confirmedAt: true,
        depositStatus: true,
      },
    },
    shipment: {
      select: {
        shipmentStatus: true,
        courierName: true,
        trackingNumber: true,
        shippedAt: true,
        deliveredAt: true,
      },
    },
    statusHistories: {
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        newStatus: true,
        changeReason: true,
        createdAt: true,
      },
    },
  },
});

type StoreOrderDetailRecord = Prisma.OrderGetPayload<typeof storeOrderDetailArgs>;

const depositRequestOrderArgs = Prisma.validator<Prisma.OrderDefaultArgs>()({
  select: {
    id: true,
    orderNumber: true,
    orderStatus: true,
    paymentRequestedAt: true,
    paymentConfirmedAt: true,
    contact: {
      select: {
        buyerPhone: true,
        receiverPhone: true,
      },
    },
    deposit: {
      select: {
        depositStatus: true,
        requestedAt: true,
        confirmedAt: true,
      },
    },
  },
});

type DepositRequestOrderRecord = Prisma.OrderGetPayload<typeof depositRequestOrderArgs>;

const customOrderLinkArgs = Prisma.validator<Prisma.CustomOrderLinkDefaultArgs>()({
  select: {
    id: true,
    token: true,
    productName: true,
    note: true,
    totalProductPrice: true,
    shippingFee: true,
    finalTotalPrice: true,
    isActive: true,
    usageCount: true,
    expiresAt: true,
    usedAt: true,
    usedOrderId: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    usedOrder: {
      select: {
        id: true,
        orderNumber: true,
      },
    },
  },
});

type CustomOrderLinkRecord = Prisma.CustomOrderLinkGetPayload<typeof customOrderLinkArgs>;

@Injectable()
export class StoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly orderNotifications: OrderNotificationsService,
    private readonly storeCache: StoreCacheService,
  ) {}

  async getVisibleCategories() {
    return this.storeCache.getOrSet('store:categories:v1', STORE_CATEGORIES_CACHE_TTL_MS, async () => {
      const categories = await this.prisma.category.findMany({
        where: { isVisible: true },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          parentId: true,
          name: true,
          slug: true,
          imageUrl: true,
          isOnLandingPage: true,
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
          imageUrl: category.imageUrl,
          isOnLandingPage: category.isOnLandingPage,
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
    });
  }

  async getActiveHomePopup(): Promise<StoreHomePopupResponse | null> {
    return this.storeCache.getOrSet('store:home-popup:v1', STORE_HOME_POPUP_CACHE_TTL_MS, async () => {
      const popup = await this.prisma.homePopup.findFirst({
        where: {
          isActive: true,
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      });

      if (!popup) {
        return null;
      }

      return {
        id: Number(popup.id),
        title: popup.title,
        imageUrl: popup.imageUrl,
        linkUrl: popup.linkUrl,
        isActive: popup.isActive,
        createdAt: popup.createdAt.toISOString(),
        updatedAt: popup.updatedAt.toISOString(),
      };
    });
  }

  async getHomeHero(): Promise<StoreHomeHeroResponse | null> {
    return this.storeCache.getOrSet('store:home-hero:v1', STORE_HOME_POPUP_CACHE_TTL_MS, async () => {
      const hero = await this.prisma.homeHeroSetting.findUnique({
        where: { key: 'default' },
      });

      if (!hero) {
        return null;
      }

      return {
        imageUrl: hero.imageUrl,
        updatedAt: hero.updatedAt.toISOString(),
      };
    });
  }

  async getStorefrontSettings(): Promise<StorefrontSettingsResponse> {
    return this.storeCache.getOrSet('store:settings:v1', STORE_HOME_POPUP_CACHE_TTL_MS, async () => {
      const settings = await this.prisma.storefrontSetting.upsert({
        where: { key: 'default' },
        create: { key: 'default' },
        update: {},
      });

      return {
        userWebFontSize: settings.userWebFontSize,
        updatedAt: settings.updatedAt.toISOString(),
      };
    });
  }

  async getVisibleNotices(): Promise<{ items: StoreNoticeListItemResponse[] }> {
    return this.storeCache.getOrSet('store:notices:v1', STORE_NOTICE_CACHE_TTL_MS, async () => {
      const notices = await this.prisma.notice.findMany({
        where: {
          deletedAt: null,
          isPublished: true,
          publishedAt: {
            lte: new Date(),
          },
        },
        orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
      });

      return {
        items: notices.map((notice) => {
          const content = this.normalizeNoticeContent(notice.contentJson);

          return {
            id: Number(notice.id),
            title: notice.title,
            summary: notice.summary,
            isPinned: notice.isPinned,
            thumbnailImageUrl: this.extractNoticeThumbnail(content.blocks),
            publishedAt: notice.publishedAt?.toISOString() ?? notice.createdAt.toISOString(),
          };
        }),
      };
    });
  }

  async getVisibleNoticeById(noticeId: number): Promise<StoreNoticeDetailResponse> {
    return this.storeCache.getOrSet(`store:notice-detail:v1:${noticeId}`, STORE_NOTICE_CACHE_TTL_MS, async () => {
      const notice = await this.prisma.notice.findFirst({
        where: {
          id: BigInt(noticeId),
          deletedAt: null,
          isPublished: true,
          publishedAt: {
            lte: new Date(),
          },
        },
      });

      if (!notice) {
        throw new NotFoundException({
          code: 'NOTICE_NOT_FOUND',
          message: '공지사항을 찾을 수 없습니다.',
        });
      }

      const content = this.normalizeNoticeContent(notice.contentJson);

      return {
        id: Number(notice.id),
        title: notice.title,
        summary: notice.summary,
        contentJson: {
          version: content.version,
          blocks: content.blocks,
        },
        isPinned: notice.isPinned,
        thumbnailImageUrl: this.extractNoticeThumbnail(content.blocks),
        publishedAt: notice.publishedAt?.toISOString() ?? notice.createdAt.toISOString(),
        updatedAt: notice.updatedAt.toISOString(),
      };
    });
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

      const categoryIds = await this.collectVisibleDescendantCategoryIds(category.id);
      where.categoryId = {
        in: categoryIds.map((id) => BigInt(id)),
      };
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput[] =
      query.sort === 'price_asc'
        ? [{ basePrice: 'asc' }, { id: 'desc' }]
        : query.sort === 'price_desc'
          ? [{ basePrice: 'desc' }, { id: 'desc' }]
          : [{ createdAt: 'desc' }, { id: 'desc' }];

    const cacheKey = `store:products:v2:${JSON.stringify({
      q: query.q ?? '',
      categorySlug: query.categorySlug ?? '',
      sort: query.sort ?? 'latest',
      page,
      size,
    })}`;

    return this.storeCache.getOrSet(cacheKey, STORE_PRODUCTS_CACHE_TTL_MS, async () => {
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
          discountRate: product.discountRate,
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
    });
  }

  async getVisibleProductById(productId: string) {
    const parsedId = Number(productId);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: '상품을 찾을 수 없습니다.',
      });
    }

    return this.storeCache.getOrSet(
      `store:product-detail:v2:${parsedId}`,
      STORE_PRODUCT_DETAIL_CACHE_TTL_MS,
      async () => {
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
            optionGroups: {
              where: { isActive: true },
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
              include: {
                options: {
                  where: { isActive: true },
                  orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
                  select: {
                    id: true,
                    name: true,
                    extraPrice: true,
                    maxQuantity: true,
                    isActive: true,
                    sortOrder: true,
                  },
                },
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
          discountRate: product.discountRate,
          isSoldOut: product.isSoldOut,
          consultationRequired: product.consultationRequired,
          images: product.images.map((image) => ({
            id: Number(image.id),
            imageType: image.imageType,
            imageUrl: image.imageUrl,
            sortOrder: image.sortOrder,
          })),
          optionGroups: product.optionGroups.map((group) => ({
            id: Number(group.id),
            name: group.name,
            selectionType: group.selectionType,
            isRequired: group.isRequired,
            isActive: group.isActive,
            sortOrder: group.sortOrder,
            options: group.options.map((option) => ({
              id: Number(option.id),
              name: option.name,
              extraPrice: option.extraPrice,
              maxQuantity: option.maxQuantity,
              isActive: option.isActive,
              sortOrder: option.sortOrder,
            })),
          })),
          policy: {
            shippingInfo: '주문 후 제작이 시작되며 지역/재고 상황에 따라 배송일이 달라질 수 있습니다.',
            refundInfo: '핸드메이드 특성상 단순 변심 반품이 제한될 수 있으니 주문 전 옵션을 확인해주세요.',
          },
        };
      },
    );
  }

  private async collectVisibleDescendantCategoryIds(rootCategoryId: bigint): Promise<number[]> {
    const visibleCategories = await this.prisma.category.findMany({
      where: { isVisible: true },
      select: {
        id: true,
        parentId: true,
      },
    });

    const childMap = new Map<string, bigint[]>();
    for (const category of visibleCategories) {
      if (!category.parentId) {
        continue;
      }

      const parentKey = category.parentId.toString();
      const siblings = childMap.get(parentKey) ?? [];
      siblings.push(category.id);
      childMap.set(parentKey, siblings);
    }

    const queue: bigint[] = [rootCategoryId];
    const visited = new Set<string>();
    const collected: number[] = [];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }

      const currentKey = current.toString();
      if (visited.has(currentKey)) {
        continue;
      }
      visited.add(currentKey);
      collected.push(Number(current));

      for (const childId of childMap.get(currentKey) ?? []) {
        queue.push(childId);
      }
    }

    return collected;
  }

  async createOrder(dto: CreateOrderDto) {
    for (let attempt = 1; attempt <= ORDER_NUMBER_RETRY_LIMIT; attempt += 1) {
      try {
        const result = await this.prisma.$transaction(
          async (tx) => {
            const now = new Date();
            const orderNumber = await this.generateOrderNumber(tx, now);
            const resolvedItems = await this.resolveOrderItems(tx, dto.items);
            const pricing = buildOrderPricingFromItems(resolvedItems, this.getShippingFee());

            return this.createOrderRecord(tx, {
              orderNumber,
              resolvedItems,
              contact: dto.contact,
              customerRequest: dto.customerRequest,
              pricing,
              now,
            });
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        );

        this.orderNotifications.notifyNewOrderCreated({
          orderId: result.orderId,
          orderNumber: result.orderNumber,
        });

        return result;
      } catch (error) {
        if (attempt < ORDER_NUMBER_RETRY_LIMIT && this.isRetryableOrderCreationError(error)) {
          continue;
        }

        throw error;
      }
    }

    throw new InternalServerErrorException({
      code: 'INTERNAL_ERROR',
      message: '주문 생성에 실패했습니다. 다시 시도해주세요.',
    });
  }

  async createCustomOrderLink(
    adminId: number,
    dto: CustomOrderLinkCreateInput,
  ): Promise<AdminCustomOrderLinkView> {
    const expiresAt = parseCustomOrderLinkExpiresAt(dto.expiresAt);
    const pricing = buildCustomOrderPricing(dto.finalTotalPrice, dto.shippingFee);

    for (let attempt = 1; attempt <= CUSTOM_ORDER_LINK_RETRY_LIMIT; attempt += 1) {
      try {
        const link = await this.prisma.customOrderLink.create({
          data: {
            token: this.generateCustomOrderToken(),
            productName: CUSTOM_ORDER_PRODUCT_NAME,
            note: dto.note?.trim() || null,
            totalProductPrice: pricing.totalProductPrice,
            shippingFee: pricing.shippingFee,
            finalTotalPrice: pricing.finalTotalPrice,
            expiresAt,
            createdByAdminId: BigInt(adminId),
          },
          ...customOrderLinkArgs,
        });

        return this.mapAdminCustomOrderLink(link);
      } catch (error) {
        if (attempt < CUSTOM_ORDER_LINK_RETRY_LIMIT && this.isRetryableCustomOrderLinkError(error)) {
          continue;
        }

        throw error;
      }
    }

    throw new InternalServerErrorException({
      code: 'INTERNAL_ERROR',
      message: '커스텀 주문 링크 생성에 실패했습니다. 다시 시도해주세요.',
    });
  }

  async getAdminCustomOrderLink(linkId: number): Promise<AdminCustomOrderLinkView> {
    const link = await this.prisma.customOrderLink.findUnique({
      where: { id: BigInt(linkId) },
      ...customOrderLinkArgs,
    });

    if (!link) {
      throw this.createCustomOrderLinkNotFoundException();
    }

    return this.mapAdminCustomOrderLink(link);
  }

  async getAdminCustomOrderLinks(limit = 10): Promise<AdminCustomOrderLinkView[]> {
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 50) : 10;

    const links = await this.prisma.customOrderLink.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: safeLimit,
      ...customOrderLinkArgs,
    });

    return links.map((link) => this.mapAdminCustomOrderLink(link));
  }

  async getCustomCheckout(token: string): Promise<StoreCustomCheckoutResponse> {
    const link = await this.findCustomOrderLinkByTokenOrThrow(token);

    return this.mapStoreCustomCheckout(link);
  }

  async createCustomCheckoutOrder(token: string, dto: CreateCustomCheckoutOrderDto) {
    for (let attempt = 1; attempt <= ORDER_NUMBER_RETRY_LIMIT; attempt += 1) {
      try {
        const result = await this.prisma.$transaction(
          async (tx) => {
            const now = new Date();
            const link = await this.findCustomOrderLinkByTokenOrThrow(tx, token);

            assertCustomOrderLinkAvailable(link, now);
            await this.reserveCustomOrderLink(tx, link.id, now);

            const order = await this.createOrderRecord(tx, {
              orderNumber: await this.generateOrderNumber(tx, now),
              resolvedItems: [],
              contact: dto.contact,
              customerRequest: dto.customerRequest,
              pricing: {
                totalProductPrice: link.totalProductPrice,
                shippingFee: link.shippingFee,
                finalTotalPrice: link.finalTotalPrice,
              },
              now,
            });

            await tx.customOrderLink.update({
              where: { id: link.id },
              data: {
                usedOrderId: BigInt(order.orderId),
              },
            });

            return order;
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        );

        this.orderNotifications.notifyNewOrderCreated({
          orderId: result.orderId,
          orderNumber: result.orderNumber,
        });

        const { items: _items, ...data } = result;

        return data;
      } catch (error) {
        if (attempt < ORDER_NUMBER_RETRY_LIMIT && this.isRetryableOrderCreationError(error)) {
          continue;
        }

        throw error;
      }
    }

    throw new InternalServerErrorException({
      code: 'INTERNAL_ERROR',
      message: '주문 생성에 실패했습니다. 다시 시도해주세요.',
    });
  }

  async getOrderByOrderNumber(
    orderNumber: string,
    contactPhone: string,
  ): Promise<StoreOrderDetailResponse> {
    const order = await this.findOrderDetailByOrderNumberOrThrow(orderNumber);
    this.assertOrderAccess(order, contactPhone);

    return this.mapOrderDetail(order);
  }

  async createDepositRequest(
    orderNumber: string,
    dto: CreateDepositRequestDto,
  ): Promise<StoreDepositRequestResponse> {
    for (let attempt = 1; attempt <= ORDER_NUMBER_RETRY_LIMIT; attempt += 1) {
      try {
        const result = await this.prisma.$transaction(
          async (tx) => {
            const order = await tx.order.findUnique({
              where: { orderNumber },
              ...depositRequestOrderArgs,
            });

            if (!order) {
              throw this.createOrderNotFoundException();
            }

            this.assertOrderHasDeposit(order);
            this.assertOrderAccess(order, dto.contactPhone);

            const decision = getDepositRequestDecision({
              orderStatus: order.orderStatus,
              depositStatus: order.deposit.depositStatus,
            });

            if (!decision.requestAccepted) {
              return {
                orderId: Number(order.id),
                orderNumber: order.orderNumber,
                orderStatus: order.orderStatus,
                depositStatus: order.deposit.depositStatus,
                requestedAt: toIsoString(order.deposit.requestedAt),
                confirmedAt: toIsoString(order.deposit.confirmedAt),
                requestAccepted: false,
              };
            }

            const now = new Date();

            await tx.deposit.update({
              where: {
                orderId: order.id,
              },
              data: {
                depositorName: dto.depositorName,
                requestedAt: now,
                depositStatus: DepositStatus.REQUESTED,
              },
            });

            let nextOrderStatus = order.orderStatus;

            if (decision.shouldTransitionOrder) {
              assertOrderStatusTransition(order.orderStatus, 'PAYMENT_REQUESTED');

              await tx.order.update({
                where: {
                  id: order.id,
                },
                data: {
                  orderStatus: 'PAYMENT_REQUESTED',
                  paymentRequestedAt: now,
                },
              });

              await tx.orderStatusHistory.create({
                data: {
                  orderId: order.id,
                  previousStatus: order.orderStatus,
                  newStatus: 'PAYMENT_REQUESTED',
                  changeReason: buildDepositRequestReason(dto.memo),
                },
              });

              nextOrderStatus = 'PAYMENT_REQUESTED';
            } else {
              await tx.order.update({
                where: {
                  id: order.id,
                },
                data: {
                  paymentRequestedAt: now,
                },
              });
            }

            return {
              orderId: Number(order.id),
              orderNumber: order.orderNumber,
              orderStatus: nextOrderStatus,
              depositStatus: DepositStatus.REQUESTED,
              requestedAt: now.toISOString(),
              confirmedAt: null,
              requestAccepted: true,
            };
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        );

        if (result.requestAccepted && result.orderStatus === 'PAYMENT_REQUESTED') {
          this.orderNotifications.notifyDepositRequested({
            orderId: result.orderId,
            orderNumber: result.orderNumber,
          });
        }

        const { orderId: _orderId, ...response } = result;
        return response;
      } catch (error) {
        if (
          attempt < ORDER_NUMBER_RETRY_LIMIT &&
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034'
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new InternalServerErrorException({
      code: 'INTERNAL_ERROR',
      message: '입금 요청 처리에 실패했습니다. 다시 시도해주세요.',
    });
  }

  async getOrderTracking(
    orderNumber: string,
    contactPhone: string,
  ): Promise<StoreOrderTrackingResponse> {
    const order = await this.findOrderDetailByOrderNumberOrThrow(orderNumber);
    this.assertOrderAccess(order, contactPhone);
    const shipment = getShipmentSnapshot(order);

    return {
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      shipmentStatus: shipment.shipmentStatus,
      courierName: shipment.courierName,
      trackingNumber: shipment.trackingNumber,
      trackingUrl: shipment.trackingUrl,
      shippedAt: shipment.shippedAt,
      deliveredAt: shipment.deliveredAt,
      events: buildTrackingEvents(order),
    };
  }

  private async resolveOrderItems(
    tx: Prisma.TransactionClient,
    items: CreateOrderItemDto[],
  ): Promise<ResolvedOrderItem[]> {
    const uniqueProductIds = [...new Set(items.map((item) => item.productId))];
    const products = await tx.product.findMany({
      where: {
        id: {
          in: uniqueProductIds.map((productId) => BigInt(productId)),
        },
        isVisible: true,
        deletedAt: null,
      },
        select: {
          id: true,
          name: true,
          basePrice: true,
          discountRate: true,
          isSoldOut: true,
          optionGroups: {
            where: { isActive: true },
            select: {
            id: true,
            name: true,
            selectionType: true,
            isRequired: true,
            options: {
              where: { isActive: true },
              select: {
                id: true,
                name: true,
                extraPrice: true,
                maxQuantity: true,
              },
            },
          },
        },
      },
    });

    const productMap = new Map(products.map((product) => [Number(product.id), product]));

    return items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new NotFoundException({
          code: 'PRODUCT_NOT_FOUND',
          message: '상품을 찾을 수 없습니다.',
        });
      }

      if (product.isSoldOut) {
        throw new ConflictException({
          code: 'OUT_OF_STOCK',
          message: '품절된 상품이 포함되어 있습니다.',
        });
      }

      const requestedSelections = item.selectedOptions ?? [];
      const groupSelectionCounts = new Map<number, number>();
      const selectedOptions = requestedSelections.map((selection) => {
        const group = product.optionGroups.find(
          (candidate) => Number(candidate.id) === selection.productOptionGroupId,
        );

        if (!group) {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: '유효하지 않은 상품 옵션 그룹입니다.',
          });
        }

        const option = group.options.find(
          (candidate) => Number(candidate.id) === selection.productOptionId,
        );

        if (!option) {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: '유효하지 않은 상품 옵션입니다.',
          });
        }

        if (group.selectionType === 'SINGLE' && selection.quantity !== 1) {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: '단일 선택 옵션은 수량 1개만 선택할 수 있습니다.',
          });
        }

        if (group.selectionType === 'QUANTITY') {
          if (option.maxQuantity !== null && selection.quantity > option.maxQuantity) {
            throw new BadRequestException({
              code: 'VALIDATION_ERROR',
              message: `${group.name} 옵션의 최대 수량을 초과했습니다.`,
            });
          }
        } else {
          const count = groupSelectionCounts.get(selection.productOptionGroupId) ?? 0;
          if (count >= 1) {
            throw new BadRequestException({
              code: 'VALIDATION_ERROR',
              message: `${group.name} 그룹에서는 하나의 옵션만 선택할 수 있습니다.`,
            });
          }
          groupSelectionCounts.set(selection.productOptionGroupId, count + 1);
        }

        return {
          group,
          option,
          quantity: selection.quantity,
        };
      });

      for (const group of product.optionGroups) {
        if (!group.isRequired) {
          continue;
        }

        const hasSelection = selectedOptions.some(
          (selection) => Number(selection.group.id) === Number(group.id),
        );

        if (!hasSelection) {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: `${group.name} 옵션을 선택해 주세요.`,
          });
        }
      }

      const totalExtraPrice = selectedOptions.reduce(
        (sum, selection) => sum + selection.option.extraPrice * selection.quantity,
        0,
      );
      const productBasePrice = calculateDiscountedPrice(product.basePrice, product.discountRate);
      const unitPrice = productBasePrice + totalExtraPrice;
      const optionGroupsSnapshot = new Map<string, string[]>();
      for (const selection of selectedOptions) {
        const valueLabel =
          selection.quantity > 1
            ? `${selection.option.name} x${selection.quantity}`
            : selection.option.name;
        const values = optionGroupsSnapshot.get(selection.group.name) ?? [];
        values.push(valueLabel);
        optionGroupsSnapshot.set(selection.group.name, values);
      }

      const optionNameSnapshot =
        optionGroupsSnapshot.size > 0 ? [...optionGroupsSnapshot.keys()].join(' / ') : null;
      const optionValueSnapshot =
        optionGroupsSnapshot.size > 0
          ? [...optionGroupsSnapshot.entries()]
              .map(([groupName, values]) => `${groupName}: ${values.join(', ')}`)
              .join(' / ')
          : null;
      const resolvedProductOptionId =
        selectedOptions.length === 1 && selectedOptions[0].quantity === 1
          ? selectedOptions[0].option.id
          : null;

      return {
        productId: product.id,
        productOptionId: resolvedProductOptionId,
        productNameSnapshot: product.name,
        optionNameSnapshot,
        optionValueSnapshot,
        unitPrice,
        quantity: item.quantity,
        lineTotalPrice: unitPrice * item.quantity,
        selectedOptions: selectedOptions.map((selection) => ({
          productOptionGroupId: selection.group.id,
          productOptionId: selection.option.id,
          groupNameSnapshot: selection.group.name,
          optionNameSnapshot: selection.option.name,
          extraPriceSnapshot: selection.option.extraPrice,
          quantity: selection.quantity,
        })),
      };
    });
  }

  private async generateOrderNumber(tx: Prisma.TransactionClient, now: Date): Promise<string> {
    const datePart = formatOrderDate(now);
    const prefix = `${ORDER_NUMBER_PREFIX}${datePart}-`;
    const latestOrder = await tx.order.findFirst({
      where: {
        orderNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        orderNumber: 'desc',
      },
      select: {
        orderNumber: true,
      },
    });

    const lastSequence = latestOrder
      ? Number(latestOrder.orderNumber.slice(-ORDER_NUMBER_SEQUENCE_WIDTH))
      : 0;

    return `${prefix}${String(lastSequence + 1).padStart(ORDER_NUMBER_SEQUENCE_WIDTH, '0')}`;
  }

  private getDepositDeadlineAt(now: Date): Date {
    const deadlineDays = Number(this.configService.get<number>('ORDER_DEPOSIT_DEADLINE_DAYS', 1));

    return getDepositDeadlineAt(now, deadlineDays);
  }

  private async createOrderRecord(
    tx: Prisma.TransactionClient,
    params: {
      orderNumber: string;
      resolvedItems: ResolvedOrderItem[];
      contact: CreateOrderContactDto;
      customerRequest?: string;
      pricing: OrderPricingSnapshot;
      now: Date;
    },
  ): Promise<StoreCreatedOrderResponse> {
    const depositDeadlineAt = this.getDepositDeadlineAt(params.now);
    const depositInfo = await this.getDepositAccountInfo();
    const normalizedContactAddress = normalizeOrderContactAddress(params.contact);

    const order = await tx.order.create({
      data: {
        orderNumber: params.orderNumber,
        orderStatus: 'PENDING_PAYMENT',
        totalProductPrice: params.pricing.totalProductPrice,
        shippingFee: params.pricing.shippingFee,
        finalTotalPrice: params.pricing.finalTotalPrice,
        customerRequest: params.customerRequest ?? null,
        depositDeadlineAt,
      },
    });

    if (params.resolvedItems.length > 0) {
      for (const item of params.resolvedItems) {
        const createdOrderItem = await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.productId,
            productOptionId: item.productOptionId,
            productNameSnapshot: item.productNameSnapshot,
            optionNameSnapshot: item.optionNameSnapshot,
            optionValueSnapshot: item.optionValueSnapshot,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            lineTotalPrice: item.lineTotalPrice,
          },
          select: {
            id: true,
          },
        });

        if (item.selectedOptions.length > 0) {
          await tx.orderItemOptionSelection.createMany({
            data: item.selectedOptions.map((selection) => ({
              orderItemId: createdOrderItem.id,
              productOptionGroupId: selection.productOptionGroupId,
              productOptionId: selection.productOptionId,
              groupNameSnapshot: selection.groupNameSnapshot,
              optionNameSnapshot: selection.optionNameSnapshot,
              extraPriceSnapshot: selection.extraPriceSnapshot,
              quantity: selection.quantity,
            })),
          });
        }
      }
    }

    await tx.orderContact.create({
      data: {
        orderId: order.id,
        buyerName: params.contact.buyerName,
        buyerPhone: params.contact.buyerPhone,
        receiverName: params.contact.receiverName,
        receiverPhone: params.contact.receiverPhone,
        zipcode: params.contact.zipcode,
        address1: normalizedContactAddress.address1,
        address2: normalizedContactAddress.address2,
      },
    });

    await tx.deposit.create({
      data: {
        orderId: order.id,
        bankName: depositInfo.bankName,
        accountHolder: depositInfo.accountHolder,
        accountNumber: depositInfo.accountNumber,
        expectedAmount: params.pricing.finalTotalPrice,
        depositStatus: 'WAITING',
      },
    });

    return {
      orderId: Number(order.id),
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      contact: {
        buyerName: params.contact.buyerName,
        buyerPhone: params.contact.buyerPhone,
        receiverName: params.contact.receiverName,
        receiverPhone: params.contact.receiverPhone,
        zipcode: params.contact.zipcode,
        address1: normalizedContactAddress.address1,
        address2: normalizedContactAddress.address2,
      },
      items: params.resolvedItems.map((item) => ({
        productId: Number(item.productId),
        productOptionId: item.productOptionId ? Number(item.productOptionId) : null,
        productNameSnapshot: item.productNameSnapshot,
        optionNameSnapshot: item.optionNameSnapshot,
        optionValueSnapshot: item.optionValueSnapshot,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotalPrice: item.lineTotalPrice,
        selectedOptions: item.selectedOptions.map((selection) => ({
          productOptionGroupId: Number(selection.productOptionGroupId),
          productOptionId: Number(selection.productOptionId),
          groupNameSnapshot: selection.groupNameSnapshot,
          optionNameSnapshot: selection.optionNameSnapshot,
          extraPriceSnapshot: selection.extraPriceSnapshot,
          quantity: selection.quantity,
        })),
      })),
      pricing: params.pricing,
      depositInfo: {
        bankName: depositInfo.bankName,
        accountHolder: depositInfo.accountHolder,
        accountNumber: depositInfo.accountNumber,
        expectedAmount: params.pricing.finalTotalPrice,
        depositStatus: 'WAITING',
        depositDeadlineAt: depositDeadlineAt.toISOString(),
      },
      createdAt: order.createdAt.toISOString(),
    };
  }

  private getShippingFee(): number {
    return Number(this.configService.get<number>('ORDER_SHIPPING_FEE', 3000));
  }

  private async getDepositAccountInfo(): Promise<DepositAccountInfo> {
    const primaryAdminDepositAccount = await this.prisma.admin.findFirst({
      where: {
        isActive: true,
        isPrimaryDepositAccount: true,
        depositBankName: { not: null },
        depositAccountHolder: { not: null },
        depositAccountNumber: { not: null },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: {
        depositBankName: true,
        depositAccountHolder: true,
        depositAccountNumber: true,
      },
    });

    if (
      primaryAdminDepositAccount?.depositBankName &&
      primaryAdminDepositAccount.depositAccountHolder &&
      primaryAdminDepositAccount.depositAccountNumber
    ) {
      return {
        bankName: primaryAdminDepositAccount.depositBankName,
        accountHolder: primaryAdminDepositAccount.depositAccountHolder,
        accountNumber: primaryAdminDepositAccount.depositAccountNumber,
      };
    }

    return {
      bankName: this.configService.get<string>('ORDER_DEPOSIT_BANK_NAME', '국민은행'),
      accountHolder: this.configService.get<string>(
        'ORDER_DEPOSIT_ACCOUNT_HOLDER',
        '도도미마켓',
      ),
      accountNumber: this.configService.get<string>(
        'ORDER_DEPOSIT_ACCOUNT_NUMBER',
        '000-00-000000',
      ),
    };
  }

  private isRetryableOrderCreationError(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code === 'P2034') {
      return true;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const target = Array.isArray(error.meta?.target)
      ? error.meta.target.map((value) => String(value))
      : [];

    return target.includes('order_number') || target.includes('orderNumber');
  }

  private isRetryableCustomOrderLinkError(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const target = Array.isArray(error.meta?.target)
      ? error.meta.target.map((value) => String(value))
      : [];

    return target.includes('token');
  }

  private generateCustomOrderToken(): string {
    return `${CUSTOM_ORDER_TOKEN_PREFIX}${randomBytes(CUSTOM_ORDER_TOKEN_BYTES).toString('base64url')}`;
  }

  private getCustomCheckoutBaseUrl(): string {
    return this.configService
      .get<string>('CUSTOM_CHECKOUT_BASE_URL', 'http://localhost:5173/custom-checkout')
      .replace(/\/+$/, '');
  }

  private buildCustomCheckoutUrl(token: string): string {
    return buildCustomCheckoutUrl(this.getCustomCheckoutBaseUrl(), token);
  }

  private async findCustomOrderLinkByTokenOrThrow(
    tokenOrTx: string | Prisma.TransactionClient,
    maybeToken?: string,
  ): Promise<CustomOrderLinkRecord> {
    const tx = typeof tokenOrTx === 'string' ? this.prisma : tokenOrTx;
    const token = typeof tokenOrTx === 'string' ? tokenOrTx : maybeToken;

    if (!token) {
      throw this.createCustomOrderLinkNotFoundException();
    }

    const link = await tx.customOrderLink.findFirst({
      where: {
        token,
        deletedAt: null,
      },
      ...customOrderLinkArgs,
    });

    if (!link) {
      throw this.createCustomOrderLinkNotFoundException();
    }

    return link;
  }

  private async reserveCustomOrderLink(
    tx: Prisma.TransactionClient,
    linkId: bigint,
    now: Date,
  ): Promise<void> {
    const updated = await tx.customOrderLink.updateMany({
      where: {
        id: linkId,
        isActive: true,
        deletedAt: null,
        usedAt: null,
        usedOrderId: null,
        expiresAt: {
          gt: now,
        },
      },
      data: {
        usedAt: now,
        usageCount: {
          increment: 1,
        },
      },
    });

    if (updated.count === 1) {
      return;
    }

    const link = await tx.customOrderLink.findUnique({
      where: { id: linkId },
      ...customOrderLinkArgs,
    });

    if (!link || link.deletedAt) {
      throw this.createCustomOrderLinkNotFoundException();
    }

    assertCustomOrderLinkAvailable(link, now);
    throw new ConflictException({
      code: 'CUSTOM_ORDER_LINK_UNAVAILABLE',
      message: '사용할 수 없는 커스텀 주문 링크입니다.',
    });
  }

  private mapAdminCustomOrderLink(link: CustomOrderLinkRecord): AdminCustomOrderLinkView {
    const now = new Date();
    const { isExpired, isUsed, isAvailable } = getCustomOrderLinkAvailability(link, now);

    return {
      linkId: Number(link.id),
      token: link.token,
      checkoutUrl: this.buildCustomCheckoutUrl(link.token),
      productName: link.productName,
      note: link.note,
      totalProductPrice: link.totalProductPrice,
      shippingFee: link.shippingFee,
      finalTotalPrice: link.finalTotalPrice,
      isActive: link.isActive,
      isExpired,
      isAvailable,
      isUsed,
      usageCount: link.usageCount,
      usedAt: toIsoString(link.usedAt),
      usedOrderId: link.usedOrderId ? Number(link.usedOrderId) : null,
      usedOrderNumber: link.usedOrder?.orderNumber ?? null,
      expiresAt: link.expiresAt.toISOString(),
      createdAt: link.createdAt.toISOString(),
      updatedAt: link.updatedAt.toISOString(),
      deletedAt: toIsoString(link.deletedAt),
    };
  }

  private mapStoreCustomCheckout(link: CustomOrderLinkRecord): StoreCustomCheckoutResponse {
    const now = new Date();
    const { isExpired, isAvailable } = getCustomOrderLinkAvailability(link, now);

    return {
      token: link.token,
      productName: link.productName,
      totalProductPrice: link.totalProductPrice,
      shippingFee: link.shippingFee,
      finalTotalPrice: link.finalTotalPrice,
      expiresAt: link.expiresAt.toISOString(),
      isExpired,
      isAvailable,
    };
  }

  private async findOrderDetailByOrderNumberOrThrow(
    orderNumber: string,
  ): Promise<StoreOrderDetailRecord> {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      ...storeOrderDetailArgs,
    });

    if (!order) {
      throw this.createOrderNotFoundException();
    }

    this.assertOrderHasRequiredRelations(order);

    return order;
  }

  private mapOrderDetail(order: StoreOrderDetailRecord): StoreOrderDetailResponse {
    this.assertOrderHasRequiredRelations(order);

    const shipment = getShipmentSnapshot(order);
    const contact = order.contact;
    const deposit = order.deposit;

    return {
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      customerRequest: order.customerRequest,
      items: order.items.map((item) => ({
        productNameSnapshot: item.productNameSnapshot,
        thumbnailImageUrl: item.product.images[0]?.imageUrl ?? null,
        optionNameSnapshot: item.optionNameSnapshot,
        optionValueSnapshot: item.optionValueSnapshot,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotalPrice: item.lineTotalPrice,
      })),
      contact: {
        buyerName: contact.buyerName,
        buyerPhone: contact.buyerPhone,
        receiverName: contact.receiverName,
        receiverPhone: contact.receiverPhone,
        zipcode: contact.zipcode,
        address1: contact.address1,
        address2: contact.address2,
      },
      pricing: {
        totalProductPrice: order.totalProductPrice,
        shippingFee: order.shippingFee,
        finalTotalPrice: order.finalTotalPrice,
      },
      deposit: {
        depositStatus: deposit.depositStatus,
        bankName: deposit.bankName,
        accountHolder: deposit.accountHolder,
        accountNumber: deposit.accountNumber,
        expectedAmount: deposit.expectedAmount,
        depositorName: deposit.depositorName,
        requestedAt: toIsoString(deposit.requestedAt),
        confirmedAt: toIsoString(deposit.confirmedAt),
        depositDeadlineAt: toIsoString(order.depositDeadlineAt),
      },
      shipment,
      trackingEvents: buildTrackingEvents(order),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }

  private normalizeNoticeContent(content: Prisma.JsonValue): { version: number; blocks: StoreNoticeContentBlock[] } {
    const rawVersion =
      typeof content === 'object' && content !== null && 'version' in content ? (content as { version?: unknown }).version : 1;
    const rawBlocks =
      typeof content === 'object' && content !== null && 'blocks' in content ? (content as { blocks?: unknown }).blocks : [];

    return {
      version: typeof rawVersion === 'number' && Number.isFinite(rawVersion) ? rawVersion : 1,
      blocks: Array.isArray(rawBlocks)
        ? rawBlocks.reduce<StoreNoticeContentBlock[]>((accumulator, block) => {
            if (!block || typeof block !== 'object' || !('type' in block)) {
              return accumulator;
            }

            if (block.type === 'text' && typeof block.text === 'string') {
              accumulator.push({ type: 'text', text: block.text });
              return accumulator;
            }

            if (block.type === 'image' && typeof block.imageUrl === 'string') {
              accumulator.push({
                type: 'image',
                imageUrl: block.imageUrl,
                alt: typeof block.alt === 'string' ? block.alt : null,
                caption: typeof block.caption === 'string' ? block.caption : null,
              });
              return accumulator;
            }

            return accumulator;
          }, [])
        : [],
    };
  }

  private extractNoticeThumbnail(blocks: StoreNoticeContentBlock[]): string | null {
    const imageBlock = blocks.find((block) => block.type === 'image');
    return imageBlock?.imageUrl ?? null;
  }

  private assertOrderHasRequiredRelations(
    order: StoreOrderDetailRecord,
  ): asserts order is StoreOrderDetailRecord & {
    contact: NonNullable<StoreOrderDetailRecord['contact']>;
    deposit: NonNullable<StoreOrderDetailRecord['deposit']>;
  } {
    if (!order.contact || !order.deposit) {
      throw new InternalServerErrorException({
        code: 'INTERNAL_ERROR',
        message: '주문 상세 데이터가 올바르지 않습니다.',
      });
    }
  }

  private assertOrderHasDeposit(
    order: DepositRequestOrderRecord,
  ): asserts order is DepositRequestOrderRecord & {
    deposit: NonNullable<DepositRequestOrderRecord['deposit']>;
  } {
    if (!order.deposit) {
      throw new InternalServerErrorException({
        code: 'INTERNAL_ERROR',
        message: '입금 데이터가 올바르지 않습니다.',
      });
    }
  }

  private assertOrderAccess(
    order: { contact: { buyerPhone: string; receiverPhone: string } | null },
    contactPhone: string,
  ): void {
    const requestedPhone = this.normalizePhoneForAccess(contactPhone);
    const buyerPhone = this.normalizePhoneForAccess(order.contact?.buyerPhone ?? '');
    const receiverPhone = this.normalizePhoneForAccess(order.contact?.receiverPhone ?? '');

    if (requestedPhone && (requestedPhone === buyerPhone || requestedPhone === receiverPhone)) {
      return;
    }

    throw this.createOrderNotFoundException();
  }

  private normalizePhoneForAccess(value: string): string {
    return value.replace(/\D/g, '');
  }

  private createOrderNotFoundException(): NotFoundException {
    return new NotFoundException({
      code: 'ORDER_NOT_FOUND',
      message: '주문 정보를 확인할 수 없습니다.',
    });
  }

  private createInvalidDepositRequestStateException(): ConflictException {
    return new ConflictException({
      code: 'INVALID_STATUS_TRANSITION',
      message: '입금 요청을 처리할 수 없는 주문 상태입니다.',
    });
  }

  private createCustomOrderLinkNotFoundException(): NotFoundException {
    return new NotFoundException({
      code: 'CUSTOM_ORDER_LINK_NOT_FOUND',
      message: '커스텀 주문 링크를 찾을 수 없습니다.',
    });
  }
}
