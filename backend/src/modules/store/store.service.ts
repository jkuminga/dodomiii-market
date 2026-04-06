import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { DepositStatus, Prisma, ShipmentStatus } from '@prisma/client';

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
  StoreHomePopupResponse,
  StoreOrderDetailResponse,
  StoreOrderTrackingResponse,
  StoreTrackingEvent,
} from './store.types';
import { normalizeOrderContactAddress } from './utils/order-contact.util';

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
};

type DepositAccountInfo = {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
};

type OrderPricingSnapshot = {
  totalProductPrice: number;
  shippingFee: number;
  finalTotalPrice: number;
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
};

type StoreCreatedOrderResponse = {
  orderId: number;
  orderNumber: string;
  orderStatus: string;
  items: StoreCreatedOrderItem[];
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
const KST_OFFSET_HOURS = 9;
const ORDER_NUMBER_SEQUENCE_WIDTH = 4;
const TRACKING_BASE_URL = 'https://tracker.example.com';
const DEPOSIT_REQUEST_REASON = '입금 요청 접수';
const CUSTOM_ORDER_PRODUCT_NAME = '커스텀 주문';
const CUSTOM_ORDER_TOKEN_PREFIX = 'cus_';
const CUSTOM_ORDER_TOKEN_BYTES = 24;

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
        adminMemo: true,
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
  ) {}

  async getVisibleCategories() {
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
  }

  async getActiveHomePopup(): Promise<StoreHomePopupResponse | null> {
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

  async createOrder(dto: CreateOrderDto) {
    for (let attempt = 1; attempt <= ORDER_NUMBER_RETRY_LIMIT; attempt += 1) {
      try {
        const result = await this.prisma.$transaction(
          async (tx) => {
            const now = new Date();
            const orderNumber = await this.generateOrderNumber(tx, now);
            const resolvedItems = await this.resolveOrderItems(tx, dto.items);
            const pricing = this.buildOrderPricingFromItems(resolvedItems);

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
    const expiresAt = this.parseCustomOrderLinkExpiresAt(dto.expiresAt);
    const pricing = this.buildCustomOrderPricing(dto.finalTotalPrice, dto.shippingFee);

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

            this.assertCustomOrderLinkAvailable(link, now);
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

  async getOrderByOrderNumber(orderNumber: string): Promise<StoreOrderDetailResponse> {
    const order = await this.findOrderDetailByOrderNumberOrThrow(orderNumber);

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

            if (
              order.deposit.depositStatus === DepositStatus.CONFIRMED ||
              (order.deposit.depositStatus === DepositStatus.REQUESTED &&
                order.orderStatus === 'PAYMENT_REQUESTED')
            ) {
              return {
                orderId: Number(order.id),
                orderNumber: order.orderNumber,
                orderStatus: order.orderStatus,
                depositStatus: order.deposit.depositStatus,
                requestedAt: this.toIsoString(order.deposit.requestedAt),
                confirmedAt: this.toIsoString(order.deposit.confirmedAt),
                requestAccepted: false,
              };
            }

            if (order.orderStatus !== 'PENDING_PAYMENT' && order.orderStatus !== 'PAYMENT_REQUESTED') {
              throw this.createInvalidDepositRequestStateException();
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

            if (order.orderStatus === 'PENDING_PAYMENT') {
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
                  changeReason: this.buildDepositRequestReason(dto.memo),
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

  async getOrderTracking(orderNumber: string): Promise<StoreOrderTrackingResponse> {
    const order = await this.findOrderDetailByOrderNumberOrThrow(orderNumber);
    const shipment = this.getShipmentSnapshot(order);

    return {
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      shipmentStatus: shipment.shipmentStatus,
      courierName: shipment.courierName,
      trackingNumber: shipment.trackingNumber,
      trackingUrl: shipment.trackingUrl,
      shippedAt: shipment.shippedAt,
      deliveredAt: shipment.deliveredAt,
      events: this.buildTrackingEvents(order),
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
        isSoldOut: true,
        stockQuantity: true,
        options: {
          where: { isActive: true },
          select: {
            id: true,
            optionGroupName: true,
            optionValue: true,
            extraPrice: true,
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

      if (product.isSoldOut || (product.stockQuantity !== null && product.stockQuantity < item.quantity)) {
        throw new ConflictException({
          code: 'OUT_OF_STOCK',
          message: '재고가 부족한 상품이 포함되어 있습니다.',
        });
      }

      const requestedOptionIds =
        item.selectedOptionIds && item.selectedOptionIds.length > 0
          ? [...new Set(item.selectedOptionIds)]
          : item.productOptionId
            ? [item.productOptionId]
            : [];

      const selectedOptions = requestedOptionIds.map((optionId) => {
        const option = product.options.find((candidate) => Number(candidate.id) === optionId);

        if (!option) {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: '유효하지 않은 상품 옵션입니다.',
          });
        }

        return option;
      });

      const totalExtraPrice = selectedOptions.reduce((sum, option) => sum + option.extraPrice, 0);
      const unitPrice = product.basePrice + totalExtraPrice;
      const optionGroupsSnapshot = new Map<string, string[]>();
      for (const option of selectedOptions) {
        const values = optionGroupsSnapshot.get(option.optionGroupName) ?? [];
        values.push(option.optionValue);
        optionGroupsSnapshot.set(option.optionGroupName, values);
      }

      const optionNameSnapshot =
        optionGroupsSnapshot.size > 0 ? [...optionGroupsSnapshot.keys()].join(' / ') : null;
      const optionValueSnapshot =
        optionGroupsSnapshot.size > 0
          ? [...optionGroupsSnapshot.entries()]
              .map(([groupName, values]) => `${groupName}: ${values.join(', ')}`)
              .join(' / ')
          : null;
      const resolvedProductOptionId = selectedOptions.length === 1 ? selectedOptions[0].id : null;

      return {
        productId: product.id,
        productOptionId: resolvedProductOptionId,
        productNameSnapshot: product.name,
        optionNameSnapshot,
        optionValueSnapshot,
        unitPrice,
        quantity: item.quantity,
        lineTotalPrice: unitPrice * item.quantity,
      };
    });
  }

  private async generateOrderNumber(tx: Prisma.TransactionClient, now: Date): Promise<string> {
    const datePart = this.formatOrderDate(now);
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

  private formatOrderDate(now: Date): string {
    const kstDate = this.toKstDate(now);
    const year = kstDate.getUTCFullYear();
    const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(kstDate.getUTCDate()).padStart(2, '0');

    return `${year}${month}${day}`;
  }

  private getDepositDeadlineAt(now: Date): Date {
    const kstDate = this.toKstDate(now);
    const deadlineDays = Number(this.configService.get<number>('ORDER_DEPOSIT_DEADLINE_DAYS', 1));

    return new Date(
      Date.UTC(
        kstDate.getUTCFullYear(),
        kstDate.getUTCMonth(),
        kstDate.getUTCDate() + deadlineDays,
        23 - KST_OFFSET_HOURS,
        59,
        59,
      ),
    );
  }

  private toKstDate(now: Date): Date {
    return new Date(now.getTime() + KST_OFFSET_HOURS * 60 * 60 * 1000);
  }

  private buildOrderPricingFromItems(items: ResolvedOrderItem[]): OrderPricingSnapshot {
    const totalProductPrice = items.reduce((sum, item) => sum + item.lineTotalPrice, 0);
    const shippingFee = this.getShippingFee();

    return {
      totalProductPrice,
      shippingFee,
      finalTotalPrice: totalProductPrice + shippingFee,
    };
  }

  private buildCustomOrderPricing(finalTotalPrice: number, shippingFee: number): OrderPricingSnapshot {
    const totalProductPrice = finalTotalPrice - shippingFee;

    if (totalProductPrice < 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '최종 결제 금액은 배송비보다 작을 수 없습니다.',
      });
    }

    return {
      totalProductPrice,
      shippingFee,
      finalTotalPrice,
    };
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
    const depositInfo = this.getDepositAccountInfo();
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
      await tx.orderItem.createMany({
        data: params.resolvedItems.map((item) => ({
          orderId: order.id,
          productId: item.productId,
          productOptionId: item.productOptionId,
          productNameSnapshot: item.productNameSnapshot,
          optionNameSnapshot: item.optionNameSnapshot,
          optionValueSnapshot: item.optionValueSnapshot,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          lineTotalPrice: item.lineTotalPrice,
        })),
      });
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
      items: params.resolvedItems.map((item) => ({
        productId: Number(item.productId),
        productOptionId: item.productOptionId ? Number(item.productOptionId) : null,
        productNameSnapshot: item.productNameSnapshot,
        optionNameSnapshot: item.optionNameSnapshot,
        optionValueSnapshot: item.optionValueSnapshot,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotalPrice: item.lineTotalPrice,
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

  private getDepositAccountInfo(): DepositAccountInfo {
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

  private parseCustomOrderLinkExpiresAt(value: string): Date {
    const expiresAt = new Date(value);

    if (Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '만료 시각 형식이 올바르지 않습니다.',
      });
    }

    if (expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '만료 시각은 현재 시각 이후여야 합니다.',
      });
    }

    return expiresAt;
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
    return `${this.getCustomCheckoutBaseUrl()}/${encodeURIComponent(token)}`;
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

    this.assertCustomOrderLinkAvailable(link, now);
    throw new ConflictException({
      code: 'CUSTOM_ORDER_LINK_UNAVAILABLE',
      message: '사용할 수 없는 커스텀 주문 링크입니다.',
    });
  }

  private mapAdminCustomOrderLink(link: CustomOrderLinkRecord): AdminCustomOrderLinkView {
    const now = new Date();
    const isExpired = link.expiresAt.getTime() <= now.getTime();
    const isUsed = Boolean(link.usedOrderId);

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
      isAvailable: link.isActive && !isExpired && !link.deletedAt && !isUsed,
      isUsed,
      usageCount: link.usageCount,
      usedAt: this.toIsoString(link.usedAt),
      usedOrderId: link.usedOrderId ? Number(link.usedOrderId) : null,
      usedOrderNumber: link.usedOrder?.orderNumber ?? null,
      expiresAt: link.expiresAt.toISOString(),
      createdAt: link.createdAt.toISOString(),
      updatedAt: link.updatedAt.toISOString(),
      deletedAt: this.toIsoString(link.deletedAt),
    };
  }

  private mapStoreCustomCheckout(link: CustomOrderLinkRecord): StoreCustomCheckoutResponse {
    const now = new Date();
    const isExpired = link.expiresAt.getTime() <= now.getTime();

    return {
      token: link.token,
      productName: link.productName,
      totalProductPrice: link.totalProductPrice,
      shippingFee: link.shippingFee,
      finalTotalPrice: link.finalTotalPrice,
      expiresAt: link.expiresAt.toISOString(),
      isExpired,
      isAvailable: link.isActive && !isExpired && !link.usedOrderId,
    };
  }

  private assertCustomOrderLinkAvailable(link: CustomOrderLinkRecord, now: Date): void {
    if (!link.isActive) {
      throw new ConflictException({
        code: 'CUSTOM_ORDER_LINK_INACTIVE',
        message: '비활성화된 커스텀 주문 링크입니다.',
      });
    }

    if (link.expiresAt.getTime() <= now.getTime()) {
      throw new ConflictException({
        code: 'CUSTOM_ORDER_LINK_EXPIRED',
        message: '만료된 커스텀 주문 링크입니다.',
      });
    }

    if (link.usedAt || link.usedOrderId) {
      throw new ConflictException({
        code: 'CUSTOM_ORDER_LINK_ALREADY_USED',
        message: '이미 사용된 커스텀 주문 링크입니다.',
      });
    }
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

    const shipment = this.getShipmentSnapshot(order);
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
        requestedAt: this.toIsoString(deposit.requestedAt),
        confirmedAt: this.toIsoString(deposit.confirmedAt),
        depositDeadlineAt: this.toIsoString(order.depositDeadlineAt),
        adminMemo: deposit.adminMemo,
      },
      shipment,
      trackingEvents: this.buildTrackingEvents(order),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }

  private getShipmentSnapshot(order: StoreOrderDetailRecord) {
    return {
      shipmentStatus: order.shipment?.shipmentStatus ?? ShipmentStatus.READY,
      courierName: order.shipment?.courierName ?? null,
      trackingNumber: order.shipment?.trackingNumber ?? null,
      trackingUrl: this.buildTrackingUrl(order.shipment?.trackingNumber ?? null),
      shippedAt: this.toIsoString(order.shipment?.shippedAt ?? null),
      deliveredAt: this.toIsoString(order.shipment?.deliveredAt ?? null),
    };
  }

  private buildTrackingEvents(order: StoreOrderDetailRecord): StoreTrackingEvent[] {
    const events: StoreTrackingEvent[] = [
      {
        source: 'ORDER',
        status: 'PENDING_PAYMENT',
        label: '주문 접수',
        occurredAt: order.createdAt.toISOString(),
        description: '주문이 접수되었습니다.',
      },
      ...order.statusHistories.map((history) => ({
        source: 'ORDER' as const,
        status: history.newStatus,
        label: this.getOrderTrackingLabel(history.newStatus),
        occurredAt: history.createdAt.toISOString(),
        description: history.changeReason,
      })),
    ];

    const hasShippedEvent = order.statusHistories.some((history) => history.newStatus === 'SHIPPED');
    const hasDeliveredEvent = order.statusHistories.some((history) => history.newStatus === 'DELIVERED');
    const shipmentDescription = this.buildShipmentEventDescription(order.shipment);

    if (order.shipment?.shippedAt && !hasShippedEvent) {
      events.push({
        source: 'SHIPMENT',
        status: 'SHIPPED',
        label: '배송 시작',
        occurredAt: order.shipment.shippedAt.toISOString(),
        description: shipmentDescription,
      });
    }

    if (order.shipment?.deliveredAt && !hasDeliveredEvent) {
      events.push({
        source: 'SHIPMENT',
        status: 'DELIVERED',
        label: '배송 완료',
        occurredAt: order.shipment.deliveredAt.toISOString(),
        description: shipmentDescription,
      });
    }

    return events.sort((left, right) => {
      const timeDiff = new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime();
      if (timeDiff !== 0) {
        return timeDiff;
      }

      return left.source.localeCompare(right.source);
    });
  }

  private buildTrackingUrl(trackingNumber: string | null): string | null {
    if (!trackingNumber) {
      return null;
    }

    return `${TRACKING_BASE_URL}/${encodeURIComponent(trackingNumber)}`;
  }

  private buildShipmentEventDescription(
    shipment: StoreOrderDetailRecord['shipment'],
  ): string | null {
    if (!shipment) {
      return null;
    }

    const parts = [shipment.courierName, shipment.trackingNumber].filter(
      (value): value is string => Boolean(value),
    );

    return parts.length > 0 ? parts.join(' / ') : null;
  }

  private getOrderTrackingLabel(status: StoreOrderDetailRecord['orderStatus']): string {
    switch (status) {
      case 'PENDING_PAYMENT':
        return '주문 접수';
      case 'PAYMENT_REQUESTED':
        return '입금 요청 확인 중';
      case 'PAYMENT_CONFIRMED':
        return '입금 확인 완료';
      case 'PREPARING':
        return '제작 및 출고 준비';
      case 'SHIPPED':
        return '배송 중';
      case 'DELIVERED':
        return '배송 완료';
      case 'CANCELLED':
        return '주문 취소';
      case 'EXPIRED':
        return '입금 기한 만료';
      default:
        return status;
    }
  }

  private buildDepositRequestReason(memo?: string): string {
    if (!memo) {
      return DEPOSIT_REQUEST_REASON;
    }

    return `${DEPOSIT_REQUEST_REASON}: ${memo}`;
  }

  private toIsoString(value: Date | null | undefined): string | null {
    return value ? value.toISOString() : null;
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

  private createOrderNotFoundException(): NotFoundException {
    return new NotFoundException({
      code: 'ORDER_NOT_FOUND',
      message: '주문을 찾을 수 없습니다.',
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
