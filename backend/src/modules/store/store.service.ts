import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DepositStatus, Prisma, ShipmentStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { assertOrderStatusTransition } from '../orders/domain/order-status-transition';
import { CreateDepositRequestDto } from './dto/create-deposit-request.dto';
import { CreateOrderDto, CreateOrderItemDto } from './dto/create-order.dto';
import { GetProductsQueryDto } from './dto/get-products.query.dto';
import {
  StoreDepositRequestResponse,
  StoreOrderDetailResponse,
  StoreOrderTrackingResponse,
  StoreTrackingEvent,
} from './store.types';

export type CategoryTreeNode = {
  id: number;
  parentId: number | null;
  name: string;
  slug: string;
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

const ORDER_NUMBER_PREFIX = 'DM';
const ORDER_NUMBER_RETRY_LIMIT = 3;
const KST_OFFSET_HOURS = 9;
const ORDER_NUMBER_SEQUENCE_WIDTH = 4;
const TRACKING_BASE_URL = 'https://tracker.example.com';
const DEPOSIT_REQUEST_REASON = '입금 요청 접수';

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

@Injectable()
export class StoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
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

  async createOrder(dto: CreateOrderDto) {
    for (let attempt = 1; attempt <= ORDER_NUMBER_RETRY_LIMIT; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const now = new Date();
            const orderNumber = await this.generateOrderNumber(tx, now);
            const resolvedItems = await this.resolveOrderItems(tx, dto.items);
            const totalProductPrice = resolvedItems.reduce(
              (sum, item) => sum + item.lineTotalPrice,
              0,
            );
            const shippingFee = this.getShippingFee();
            const finalTotalPrice = totalProductPrice + shippingFee;
            const depositDeadlineAt = this.getDepositDeadlineAt(now);
            const depositInfo = this.getDepositAccountInfo();

            const order = await tx.order.create({
              data: {
                orderNumber,
                orderStatus: 'PENDING_PAYMENT',
                totalProductPrice,
                shippingFee,
                finalTotalPrice,
                customerRequest: dto.customerRequest ?? null,
                depositDeadlineAt,
              },
            });

            await tx.orderItem.createMany({
              data: resolvedItems.map((item) => ({
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

            await tx.orderContact.create({
              data: {
                orderId: order.id,
                buyerName: dto.contact.buyerName,
                buyerPhone: dto.contact.buyerPhone,
                receiverName: dto.contact.receiverName,
                receiverPhone: dto.contact.receiverPhone,
                zipcode: dto.contact.zipcode,
                address1: dto.contact.address1,
                address2: dto.contact.address2 ?? null,
              },
            });

            await tx.deposit.create({
              data: {
                orderId: order.id,
                bankName: depositInfo.bankName,
                accountHolder: depositInfo.accountHolder,
                accountNumber: depositInfo.accountNumber,
                expectedAmount: finalTotalPrice,
                depositStatus: 'WAITING',
              },
            });

            return {
              orderId: Number(order.id),
              orderNumber: order.orderNumber,
              orderStatus: order.orderStatus,
              items: resolvedItems.map((item) => ({
                productId: Number(item.productId),
                productOptionId: item.productOptionId ? Number(item.productOptionId) : null,
                productNameSnapshot: item.productNameSnapshot,
                optionNameSnapshot: item.optionNameSnapshot,
                optionValueSnapshot: item.optionValueSnapshot,
                unitPrice: item.unitPrice,
                quantity: item.quantity,
                lineTotalPrice: item.lineTotalPrice,
              })),
              pricing: {
                totalProductPrice,
                shippingFee,
                finalTotalPrice,
              },
              depositInfo: {
                bankName: depositInfo.bankName,
                accountHolder: depositInfo.accountHolder,
                accountNumber: depositInfo.accountNumber,
                expectedAmount: finalTotalPrice,
                depositStatus: 'WAITING',
                depositDeadlineAt: depositDeadlineAt.toISOString(),
              },
              createdAt: order.createdAt.toISOString(),
            };
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        );
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
        return await this.prisma.$transaction(
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

      const option = item.productOptionId
        ? product.options.find((candidate) => Number(candidate.id) === item.productOptionId)
        : undefined;

      if (item.productOptionId && !option) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: '유효하지 않은 상품 옵션입니다.',
        });
      }

      const unitPrice = product.basePrice + (option?.extraPrice ?? 0);

      return {
        productId: product.id,
        productOptionId: option?.id ?? null,
        productNameSnapshot: product.name,
        optionNameSnapshot: option?.optionGroupName ?? null,
        optionValueSnapshot: option?.optionValue ?? null,
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
}
