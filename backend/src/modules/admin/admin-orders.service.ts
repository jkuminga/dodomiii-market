import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  DepositStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import {
  assertOrderStatusTransition,
  getAllowedNextOrderStatuses,
} from '../orders/domain/order-status-transition';
import type {
  AdminOrderDetailResponse,
  AdminOrderListItemResponse,
} from './admin.types';
import { AdminOrderNotificationsService } from './admin-order-notifications.service';
import { GetAdminOrdersQueryDto } from './dto/get-admin-orders.query.dto';
import { UpdateAdminOrderShipmentDto } from './dto/update-admin-order-shipment.dto';
import { UpdateAdminOrderStatusDto } from './dto/update-admin-order-status.dto';

const TRACKING_BASE_URL = 'https://tracker.example.com';
const ORDER_WRITE_RETRY_LIMIT = 3;
const SHIPMENT_UPDATE_AUTO_REASON = '배송 정보 업데이트에 따라 주문 상태가 변경되었습니다.';

const adminOrderListArgs = Prisma.validator<Prisma.OrderDefaultArgs>()({
  select: {
    id: true,
    orderNumber: true,
    orderStatus: true,
    totalProductPrice: true,
    shippingFee: true,
    finalTotalPrice: true,
    createdAt: true,
    updatedAt: true,
    contact: {
      select: {
        buyerName: true,
        buyerPhone: true,
        receiverName: true,
        receiverPhone: true,
      },
    },
    deposit: {
      select: {
        depositStatus: true,
      },
    },
    shipment: {
      select: {
        trackingNumber: true,
      },
    },
  },
});

const adminOrderDetailArgs = Prisma.validator<Prisma.OrderDefaultArgs>()({
  select: {
    id: true,
    orderNumber: true,
    orderStatus: true,
    shippingRegion: true,
    totalProductPrice: true,
    shippingFee: true,
    finalTotalPrice: true,
    customerRequest: true,
    refundPolicyConsent: true,
    depositDeadlineAt: true,
    paymentRequestedAt: true,
    paymentConfirmedAt: true,
    cancelledAt: true,
    expiredAt: true,
    createdAt: true,
    updatedAt: true,
    items: {
      orderBy: [{ id: 'asc' }],
      select: {
        id: true,
        productId: true,
        productOptionId: true,
        productNameSnapshot: true,
        optionNameSnapshot: true,
        optionValueSnapshot: true,
        unitPrice: true,
        quantity: true,
        lineTotalPrice: true,
        createdAt: true,
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            deletedAt: true,
          },
        },
        productOption: {
          select: {
            id: true,
            name: true,
            isActive: true,
            optionGroup: {
              select: {
                name: true,
              },
            },
          },
        },
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
        isRemoteArea: true,
        createdAt: true,
        updatedAt: true,
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
        createdAt: true,
        updatedAt: true,
      },
    },
    shipment: {
      select: {
        courierName: true,
        trackingNumber: true,
        shippedAt: true,
        deliveredAt: true,
        createdAt: true,
        updatedAt: true,
      },
    },
    statusHistories: {
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        adminId: true,
        previousStatus: true,
        newStatus: true,
        changeReason: true,
        createdAt: true,
        admin: {
          select: {
            id: true,
            loginId: true,
            name: true,
            role: true,
          },
        },
      },
    },
  },
});

const adminOrderMutationArgs = Prisma.validator<Prisma.OrderDefaultArgs>()({
  select: {
    id: true,
    orderNumber: true,
    orderStatus: true,
    paymentRequestedAt: true,
    paymentConfirmedAt: true,
    cancelledAt: true,
    expiredAt: true,
    deposit: {
      select: {
        orderId: true,
        depositStatus: true,
        requestedAt: true,
        confirmedAt: true,
      },
    },
    shipment: {
      select: {
        orderId: true,
        courierName: true,
        trackingNumber: true,
        shippedAt: true,
        deliveredAt: true,
      },
    },
  },
});

type AdminOrderListRecord = Prisma.OrderGetPayload<typeof adminOrderListArgs>;
type AdminOrderDetailRecord = Prisma.OrderGetPayload<typeof adminOrderDetailArgs>;
type AdminOrderMutationRecord = Prisma.OrderGetPayload<typeof adminOrderMutationArgs>;

type StatusTransitionEvent = {
  orderId: number;
  orderNumber: string;
  previousStatus: AdminOrderMutationRecord['orderStatus'];
  newStatus: AdminOrderMutationRecord['orderStatus'];
  adminId: number;
  changeReason: string | null;
};

type ShipmentUpdateEvent = {
  orderId: number;
  orderNumber: string;
  orderStatus: AdminOrderMutationRecord['orderStatus'];
  shipmentStatus: 'READY' | 'SHIPPED' | 'DELIVERED';
  adminId: number;
};

type OrderListItemStats = {
  itemCount: number;
  totalQuantity: number;
};

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: AdminOrderNotificationsService,
  ) {}

  async getOrders(query: GetAdminOrdersQueryDto) {
    const page = query.page ?? 1;
    const size = query.size ?? 20;
    const where = this.buildOrderListWhere(query);

    const [totalItems, orders] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * size,
        take: size,
        ...adminOrderListArgs,
      }),
    ]);

    const orderIds = orders.map((order) => order.id);
    const itemStatsMap = new Map<string, OrderListItemStats>();

    if (orderIds.length > 0) {
      const grouped = await this.prisma.orderItem.groupBy({
        by: ['orderId'],
        where: {
          orderId: {
            in: orderIds,
          },
        },
        _count: {
          _all: true,
        },
        _sum: {
          quantity: true,
        },
      });

      for (const row of grouped) {
        itemStatsMap.set(row.orderId.toString(), {
          itemCount: row._count._all,
          totalQuantity: row._sum.quantity ?? 0,
        });
      }
    }

    return {
      items: orders.map((order) => this.mapOrderListItem(order, itemStatsMap)),
      meta: {
        page,
        size,
        totalItems,
        totalPages: Math.ceil(totalItems / size),
      },
    };
  }

  async getOrder(orderId: number): Promise<AdminOrderDetailResponse> {
    const order = await this.findOrderDetailByIdOrThrow(this.prisma, BigInt(orderId));

    return this.mapOrderDetail(order);
  }

  async deleteOrder(
    orderId: number,
  ): Promise<{ deleted: true; orderId: number; orderNumber: string }> {
    try {
      const deletedOrder = await this.prisma.order.delete({
        where: {
          id: BigInt(orderId),
        },
        select: {
          id: true,
          orderNumber: true,
        },
      });

      return {
        deleted: true,
        orderId: Number(deletedOrder.id),
        orderNumber: deletedOrder.orderNumber,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw this.createOrderNotFoundException();
      }

      throw error;
    }
  }

  async updateOrderStatus(
    orderId: number,
    adminId: number,
    dto: UpdateAdminOrderStatusDto,
  ): Promise<AdminOrderDetailResponse> {
    const result = await this.runOrderWriteTransaction(async (tx) => {
      const order = await this.findOrderForMutationByIdOrThrow(tx, BigInt(orderId));
      const transitions: StatusTransitionEvent[] = [];
      const now = new Date();
      const previousStatus = order.orderStatus;

      await this.transitionOrderStatus(tx, order, dto.orderStatus, adminId, dto.changeReason ?? null, now);

      transitions.push({
        orderId: Number(order.id),
        orderNumber: order.orderNumber,
        previousStatus,
        newStatus: dto.orderStatus,
        adminId,
        changeReason: dto.changeReason ?? null,
      });

      const updatedOrder = await this.findOrderDetailByIdOrThrow(tx, order.id);

      return {
        detail: this.mapOrderDetail(updatedOrder),
        statusTransitions: transitions,
        shipmentEvent: this.shouldDispatchShipmentEventForStatus(dto.orderStatus)
          ? this.buildShipmentNotificationEvent(updatedOrder, adminId)
          : null,
      };
    });

    this.dispatchOrderMutationHooks(result.statusTransitions, result.shipmentEvent);

    return result.detail;
  }

  async updateOrderShipment(
    orderId: number,
    adminId: number,
    dto: UpdateAdminOrderShipmentDto,
  ): Promise<AdminOrderDetailResponse> {
    if (
      dto.orderStatus === undefined &&
      dto.courierName === undefined &&
      dto.trackingNumber === undefined &&
      dto.shippedAt === undefined &&
      dto.deliveredAt === undefined
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '수정할 배송 정보가 없습니다.',
      });
    }

    const result = await this.runOrderWriteTransaction(async (tx) => {
      const order = await this.findOrderForMutationByIdOrThrow(tx, BigInt(orderId));
      const now = new Date();
      const transitions: StatusTransitionEvent[] = [];

      if (order.orderStatus === 'CANCELLED' || order.orderStatus === 'EXPIRED') {
        throw this.createInvalidShipmentStateException(
          '종료된 주문은 배송 정보를 수정할 수 없습니다.',
        );
      }

      const nextShipment = this.normalizeShipmentPatch(order, dto, now);
      const nextOrderStatus = dto.orderStatus;

      await tx.shipment.upsert({
        where: {
          orderId: order.id,
        },
        create: {
          orderId: order.id,
          courierName: nextShipment.courierName,
          trackingNumber: nextShipment.trackingNumber,
          shippedAt: nextShipment.shippedAt,
          deliveredAt: nextShipment.deliveredAt,
        },
        update: {
          courierName: nextShipment.courierName,
          trackingNumber: nextShipment.trackingNumber,
          shippedAt: nextShipment.shippedAt,
          deliveredAt: nextShipment.deliveredAt,
        },
      });

      if (nextOrderStatus === 'SHIPPED' && order.orderStatus === 'PREPARING') {
        await this.transitionOrderStatus(
          tx,
          order,
          'SHIPPED',
          adminId,
          dto.changeReason ?? SHIPMENT_UPDATE_AUTO_REASON,
          nextShipment.shippedAt ?? now,
        );

        transitions.push({
          orderId: Number(order.id),
          orderNumber: order.orderNumber,
          previousStatus: 'PREPARING',
          newStatus: 'SHIPPED',
          adminId,
          changeReason: dto.changeReason ?? SHIPMENT_UPDATE_AUTO_REASON,
        });
      }

      if (nextOrderStatus === 'DELIVERED' && order.orderStatus === 'SHIPPED') {
        await this.transitionOrderStatus(
          tx,
          order,
          'DELIVERED',
          adminId,
          dto.changeReason ?? SHIPMENT_UPDATE_AUTO_REASON,
          nextShipment.deliveredAt ?? now,
        );

        transitions.push({
          orderId: Number(order.id),
          orderNumber: order.orderNumber,
          previousStatus: 'SHIPPED',
          newStatus: 'DELIVERED',
          adminId,
          changeReason: dto.changeReason ?? SHIPMENT_UPDATE_AUTO_REASON,
        });
      }

      const updatedOrder = await this.findOrderDetailByIdOrThrow(tx, order.id);

      return {
        detail: this.mapOrderDetail(updatedOrder),
        statusTransitions: transitions,
        shipmentEvent: this.buildShipmentNotificationEvent(updatedOrder, adminId),
      };
    });

    this.dispatchOrderMutationHooks(result.statusTransitions, result.shipmentEvent);

    return result.detail;
  }

  private buildOrderListWhere(query: GetAdminOrdersQueryDto): Prisma.OrderWhereInput {
    const filters: Prisma.OrderWhereInput[] = [];
    const keyword = query.keyword?.trim() ?? '';
    const keywordVariants = this.buildKeywordVariants(keyword);

    if (query.orderStatus) {
      filters.push({
        orderStatus: query.orderStatus,
      });
    }

    if (query.orderNumber) {
      filters.push({
        orderNumber: {
          contains: query.orderNumber,
          mode: 'insensitive',
        },
      });
    }

    if (keyword) {
      const phoneFilters: Prisma.OrderWhereInput[] = [];
      for (const variant of [keyword, ...keywordVariants]) {
        phoneFilters.push(
          {
            contact: {
              is: {
                buyerPhone: {
                  contains: variant,
                  mode: 'insensitive',
                },
              },
            },
          },
          {
            contact: {
              is: {
                receiverPhone: {
                  contains: variant,
                  mode: 'insensitive',
                },
              },
            },
          },
        );
      }

      filters.push({
        OR: [
          {
            orderNumber: {
              contains: keyword,
              mode: 'insensitive',
            },
          },
          {
            contact: {
              is: {
                buyerName: {
                  contains: keyword,
                  mode: 'insensitive',
                },
              },
            },
          },
          {
            contact: {
              is: {
                receiverName: {
                  contains: keyword,
                  mode: 'insensitive',
                },
              },
            },
          },
          {
            deposit: {
              is: {
                depositorName: {
                  contains: keyword,
                  mode: 'insensitive',
                },
              },
            },
          },
          {
            shipment: {
              is: {
                trackingNumber: {
                  contains: keyword,
                  mode: 'insensitive',
                },
              },
            },
          },
          ...phoneFilters,
        ],
      });
    }

    return filters.length > 0 ? { AND: filters } : {};
  }

  private buildKeywordVariants(keyword: string): string[] {
    const digitsOnly = keyword.replace(/\D/g, '');
    const variants = new Set<string>();

    if (digitsOnly.length > 0 && digitsOnly !== keyword) {
      variants.add(digitsOnly);
    }

    const hyphenated = this.formatPhoneSearchCandidate(digitsOnly);
    if (hyphenated && hyphenated !== keyword) {
      variants.add(hyphenated);
    }

    return [...variants];
  }

  private formatPhoneSearchCandidate(value: string): string | null {
    if (value.length === 11 && value.startsWith('010')) {
      return `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7)}`;
    }

    if (value.length === 10 && value.startsWith('02')) {
      return `${value.slice(0, 2)}-${value.slice(2, 6)}-${value.slice(6)}`;
    }

    if (value.length === 9 && value.startsWith('02')) {
      return `${value.slice(0, 2)}-${value.slice(2, 5)}-${value.slice(5)}`;
    }

    if (value.length === 10) {
      return `${value.slice(0, 3)}-${value.slice(3, 6)}-${value.slice(6)}`;
    }

    return null;
  }

  private mapOrderListItem(
    order: AdminOrderListRecord,
    itemStatsMap: Map<string, OrderListItemStats>,
  ): AdminOrderListItemResponse {
    const shipmentStatus = this.getShipmentStatus(order.orderStatus);
    const itemStats = itemStatsMap.get(order.id.toString()) ?? {
      itemCount: 0,
      totalQuantity: 0,
    };

    return {
      id: Number(order.id),
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      itemCount: itemStats.itemCount,
      totalQuantity: itemStats.totalQuantity,
      totalProductPrice: order.totalProductPrice,
      shippingFee: order.shippingFee,
      finalTotalPrice: order.finalTotalPrice,
      buyerName: order.contact?.buyerName ?? null,
      buyerPhone: order.contact?.buyerPhone ?? null,
      receiverName: order.contact?.receiverName ?? null,
      receiverPhone: order.contact?.receiverPhone ?? null,
      depositStatus: order.deposit?.depositStatus ?? null,
      shipmentStatus,
      trackingNumber: order.shipment?.trackingNumber ?? null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }

  private mapOrderDetail(order: AdminOrderDetailRecord): AdminOrderDetailResponse {
    this.assertOrderHasRequiredRelations(order);

    return {
      orderId: Number(order.id),
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      shippingRegion: order.shippingRegion,
      customerRequest: order.customerRequest,
      refundPolicyConsent: order.refundPolicyConsent,
      pricing: {
        totalProductPrice: order.totalProductPrice,
        shippingFee: order.shippingFee,
        finalTotalPrice: order.finalTotalPrice,
      },
      depositDeadlineAt: this.toIsoString(order.depositDeadlineAt),
      paymentRequestedAt: this.toIsoString(order.paymentRequestedAt),
      paymentConfirmedAt: this.toIsoString(order.paymentConfirmedAt),
      cancelledAt: this.toIsoString(order.cancelledAt),
      expiredAt: this.toIsoString(order.expiredAt),
      allowedNextStatuses: getAllowedNextOrderStatuses(order.orderStatus),
      items: order.items.map((item) => ({
        orderItemId: Number(item.id),
        productId: Number(item.productId),
        productOptionId: item.productOptionId ? Number(item.productOptionId) : null,
        productNameSnapshot: item.productNameSnapshot,
        optionNameSnapshot: item.optionNameSnapshot,
        optionValueSnapshot: item.optionValueSnapshot,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotalPrice: item.lineTotalPrice,
        product: {
          id: Number(item.product.id),
          name: item.product.name,
          slug: item.product.slug,
          deletedAt: this.toIsoString(item.product.deletedAt),
        },
        productOption: item.productOption
          ? {
              id: Number(item.productOption.id),
              optionGroupName: item.productOption.optionGroup.name,
              optionValue: item.productOption.name,
              isActive: item.productOption.isActive,
            }
          : null,
      })),
      contact: {
        buyerName: order.contact.buyerName,
        buyerPhone: order.contact.buyerPhone,
        receiverName: order.contact.receiverName,
        receiverPhone: order.contact.receiverPhone,
        zipcode: order.contact.zipcode,
        address1: order.contact.address1,
        address2: order.contact.address2,
        isRemoteArea: order.contact.isRemoteArea,
        createdAt: order.contact.createdAt.toISOString(),
        updatedAt: order.contact.updatedAt.toISOString(),
      },
      deposit: {
        depositStatus: order.deposit.depositStatus,
        bankName: order.deposit.bankName,
        accountHolder: order.deposit.accountHolder,
        accountNumber: order.deposit.accountNumber,
        expectedAmount: order.deposit.expectedAmount,
        depositorName: order.deposit.depositorName,
        requestedAt: this.toIsoString(order.deposit.requestedAt),
        confirmedAt: this.toIsoString(order.deposit.confirmedAt),
        depositDeadlineAt: this.toIsoString(order.depositDeadlineAt),
        adminMemo: order.deposit.adminMemo,
        createdAt: order.deposit.createdAt.toISOString(),
        updatedAt: order.deposit.updatedAt.toISOString(),
      },
      shipment: {
        shipmentStatus: this.getShipmentStatus(order.orderStatus),
        courierName: order.shipment?.courierName ?? null,
        trackingNumber: order.shipment?.trackingNumber ?? null,
        trackingUrl: this.buildTrackingUrl(order.shipment?.trackingNumber ?? null),
        shippedAt: this.toIsoString(order.shipment?.shippedAt ?? null),
        deliveredAt: this.toIsoString(order.shipment?.deliveredAt ?? null),
        createdAt: this.toIsoString(order.shipment?.createdAt ?? null),
        updatedAt: this.toIsoString(order.shipment?.updatedAt ?? null),
      },
      statusHistories: order.statusHistories.map((history) => ({
        orderStatusHistoryId: Number(history.id),
        changedByAdminId: history.adminId ? Number(history.adminId) : null,
        previousStatus: history.previousStatus,
        newStatus: history.newStatus,
        changeReason: history.changeReason,
        createdAt: history.createdAt.toISOString(),
        admin: history.admin
          ? {
              id: Number(history.admin.id),
              loginId: history.admin.loginId,
              name: history.admin.name,
              role: history.admin.role,
            }
          : null,
      })),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }

  private async findOrderDetailByIdOrThrow(
    tx: PrismaService | Prisma.TransactionClient,
    orderId: bigint,
  ): Promise<AdminOrderDetailRecord> {
    const order = await tx.order.findUnique({
      where: {
        id: orderId,
      },
      ...adminOrderDetailArgs,
    });

    if (!order) {
      throw this.createOrderNotFoundException();
    }

    return order;
  }

  private async findOrderForMutationByIdOrThrow(
    tx: Prisma.TransactionClient,
    orderId: bigint,
  ): Promise<AdminOrderMutationRecord> {
    const order = await tx.order.findUnique({
      where: {
        id: orderId,
      },
      ...adminOrderMutationArgs,
    });

    if (!order) {
      throw this.createOrderNotFoundException();
    }

    return order;
  }

  private async transitionOrderStatus(
    tx: Prisma.TransactionClient,
    order: AdminOrderMutationRecord,
    nextStatus: AdminOrderMutationRecord['orderStatus'],
    adminId: number,
    changeReason: string | null,
    occurredAt: Date,
  ): Promise<void> {
    try {
      assertOrderStatusTransition(order.orderStatus, nextStatus);
    } catch {
      throw this.createInvalidStatusTransitionException(order.orderStatus, nextStatus);
    }

    const currentStatus = order.orderStatus;

    await tx.order.update({
      where: {
        id: order.id,
      },
      data: {
        orderStatus: nextStatus,
        paymentConfirmedAt:
          nextStatus === 'PAYMENT_CONFIRMED'
            ? (order.paymentConfirmedAt ?? occurredAt)
            : undefined,
        cancelledAt:
          nextStatus === 'CANCELLED'
            ? (order.cancelledAt ?? occurredAt)
            : undefined,
        expiredAt:
          nextStatus === 'EXPIRED'
            ? (order.expiredAt ?? occurredAt)
            : undefined,
      },
    });

    if (nextStatus === 'PAYMENT_CONFIRMED') {
      this.assertOrderHasDeposit(order);

      await tx.deposit.update({
        where: {
          orderId: order.id,
        },
        data: {
          depositStatus: DepositStatus.CONFIRMED,
          requestedAt: order.deposit.requestedAt ?? occurredAt,
          confirmedAt:
            nextStatus === 'PAYMENT_CONFIRMED'
              ? (order.deposit.confirmedAt ?? occurredAt)
              : undefined,
        },
      });
    }

    if (nextStatus === 'PREPARING' || nextStatus === 'SHIPPED' || nextStatus === 'DELIVERED') {
      const shippedAt =
        nextStatus === 'SHIPPED' || nextStatus === 'DELIVERED'
          ? (order.shipment?.shippedAt ?? occurredAt)
          : order.shipment?.shippedAt ?? null;
      const deliveredAt =
        nextStatus === 'DELIVERED'
          ? (order.shipment?.deliveredAt ?? occurredAt)
          : order.shipment?.deliveredAt ?? null;

      await tx.shipment.upsert({
        where: {
          orderId: order.id,
        },
        create: {
          orderId: order.id,
          courierName: order.shipment?.courierName ?? null,
          trackingNumber: order.shipment?.trackingNumber ?? null,
          shippedAt,
          deliveredAt,
        },
        update: {
          shippedAt,
          deliveredAt,
        },
      });
    }

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        adminId: BigInt(adminId),
        previousStatus: currentStatus,
        newStatus: nextStatus,
        changeReason,
      },
    });

    order.orderStatus = nextStatus;
    order.paymentConfirmedAt =
      nextStatus === 'PAYMENT_CONFIRMED'
        ? (order.paymentConfirmedAt ?? occurredAt)
        : order.paymentConfirmedAt;
    order.cancelledAt =
      nextStatus === 'CANCELLED' ? (order.cancelledAt ?? occurredAt) : order.cancelledAt;
    order.expiredAt =
      nextStatus === 'EXPIRED' ? (order.expiredAt ?? occurredAt) : order.expiredAt;

    if (order.deposit) {
      if (nextStatus === 'PAYMENT_CONFIRMED') {
        order.deposit.depositStatus = DepositStatus.CONFIRMED;
        order.deposit.requestedAt = order.deposit.requestedAt ?? occurredAt;
        order.deposit.confirmedAt = order.deposit.confirmedAt ?? occurredAt;
      }
    }

    if (nextStatus === 'PREPARING') {
      order.shipment = {
        orderId: order.id,
        courierName: order.shipment?.courierName ?? null,
        trackingNumber: order.shipment?.trackingNumber ?? null,
        shippedAt: order.shipment?.shippedAt ?? null,
        deliveredAt: order.shipment?.deliveredAt ?? null,
      };
    }

    if (nextStatus === 'SHIPPED') {
      order.shipment = {
        orderId: order.id,
        courierName: order.shipment?.courierName ?? null,
        trackingNumber: order.shipment?.trackingNumber ?? null,
        shippedAt: order.shipment?.shippedAt ?? occurredAt,
        deliveredAt: order.shipment?.deliveredAt ?? null,
      };
    }

    if (nextStatus === 'DELIVERED') {
      order.shipment = {
        orderId: order.id,
        courierName: order.shipment?.courierName ?? null,
        trackingNumber: order.shipment?.trackingNumber ?? null,
        shippedAt: order.shipment?.shippedAt ?? occurredAt,
        deliveredAt: order.shipment?.deliveredAt ?? occurredAt,
      };
    }
  }

  private normalizeShipmentPatch(
    order: AdminOrderMutationRecord,
    dto: UpdateAdminOrderShipmentDto,
    now: Date,
  ): {
    courierName: string | null;
    trackingNumber: string | null;
    shippedAt: Date | null;
    deliveredAt: Date | null;
  } {
    const courierName =
      dto.courierName !== undefined ? dto.courierName ?? null : order.shipment?.courierName ?? null;
    const trackingNumber =
      dto.trackingNumber !== undefined
        ? dto.trackingNumber ?? null
        : order.shipment?.trackingNumber ?? null;

    let shippedAt =
      dto.shippedAt !== undefined
        ? this.parseDateOrNull(dto.shippedAt)
        : order.shipment?.shippedAt ?? null;
    let deliveredAt =
      dto.deliveredAt !== undefined
        ? this.parseDateOrNull(dto.deliveredAt)
        : order.shipment?.deliveredAt ?? null;

    if (dto.orderStatus === 'SHIPPED' && !shippedAt) {
      shippedAt = order.shipment?.shippedAt ?? now;
    }

    if (dto.orderStatus === 'DELIVERED') {
      deliveredAt = deliveredAt ?? order.shipment?.deliveredAt ?? now;
      shippedAt = shippedAt ?? order.shipment?.shippedAt ?? deliveredAt;
    }

    if (deliveredAt && !shippedAt) {
      shippedAt = order.shipment?.shippedAt ?? deliveredAt;
    }

    if (shippedAt && deliveredAt && deliveredAt.getTime() < shippedAt.getTime()) {
      throw this.createInvalidShipmentStateException(
        '배송 완료 시각은 배송 시작 시각보다 빠를 수 없습니다.',
      );
    }

    return {
      courierName,
      trackingNumber,
      shippedAt,
      deliveredAt,
    };
  }

  private buildShipmentNotificationEvent(
    order: AdminOrderDetailRecord,
    adminId: number,
  ): ShipmentUpdateEvent {
    return {
      orderId: Number(order.id),
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      shipmentStatus: this.getShipmentStatus(order.orderStatus),
      adminId,
    };
  }

  private getShipmentStatus(orderStatus: AdminOrderMutationRecord['orderStatus']): 'READY' | 'SHIPPED' | 'DELIVERED' {
    if (orderStatus === 'DELIVERED') return 'DELIVERED';
    if (orderStatus === 'SHIPPED') return 'SHIPPED';
    return 'READY';
  }

  private dispatchOrderMutationHooks(
    transitions: StatusTransitionEvent[],
    _shipmentEvent: ShipmentUpdateEvent | null,
  ): void {
    for (const transition of transitions) {
      this.notifications.notifyOrderStatusChanged(transition);
    }

    // 배송 정보 수정은 관리자가 직접 수행하므로 관리자 요약 알림을 보내지 않는다.
  }

  private async runOrderWriteTransaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= ORDER_WRITE_RETRY_LIMIT; attempt += 1) {
      try {
        return await this.prisma.$transaction(callback, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (
          attempt < ORDER_WRITE_RETRY_LIMIT &&
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034'
        ) {
          continue;
        }

        if (
          attempt === ORDER_WRITE_RETRY_LIMIT &&
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034'
        ) {
          throw new ConflictException({
            code: 'ORDER_WRITE_CONFLICT',
            message: '주문 변경이 동시에 처리되고 있습니다. 다시 시도해주세요.',
          });
        }

        throw error;
      }
    }

    throw new ConflictException({
      code: 'ORDER_WRITE_CONFLICT',
      message: '주문 변경이 동시에 처리되고 있습니다. 다시 시도해주세요.',
    });
  }

  private parseDateOrNull(value: string | null | undefined): Date | null {
    if (value == null) {
      return null;
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '유효한 날짜 형식이 아닙니다.',
      });
    }

    return parsed;
  }

  private buildTrackingUrl(trackingNumber: string | null): string | null {
    if (!trackingNumber) {
      return null;
    }

    return `${TRACKING_BASE_URL}/${encodeURIComponent(trackingNumber)}`;
  }

  private toIsoString(value: Date | null | undefined): string | null {
    return value ? value.toISOString() : null;
  }

  private assertOrderHasRequiredRelations(
    order: AdminOrderDetailRecord,
  ): asserts order is AdminOrderDetailRecord & {
    contact: NonNullable<AdminOrderDetailRecord['contact']>;
    deposit: NonNullable<AdminOrderDetailRecord['deposit']>;
  } {
    if (!order.contact || !order.deposit) {
      throw new InternalServerErrorException({
        code: 'INTERNAL_ERROR',
        message: '주문 상세 데이터가 올바르지 않습니다.',
      });
    }
  }

  private assertOrderHasDeposit(
    order: AdminOrderMutationRecord,
  ): asserts order is AdminOrderMutationRecord & {
    deposit: NonNullable<AdminOrderMutationRecord['deposit']>;
  } {
    if (!order.deposit) {
      throw new InternalServerErrorException({
        code: 'INTERNAL_ERROR',
        message: '주문 입금 데이터가 올바르지 않습니다.',
      });
    }
  }

  private createOrderNotFoundException(): NotFoundException {
    return new NotFoundException({
      code: 'ORDER_NOT_FOUND',
      message: '주문을 찾을 수 없습니다.',
    });
  }

  private createInvalidStatusTransitionException(
    from: AdminOrderMutationRecord['orderStatus'],
    to: AdminOrderMutationRecord['orderStatus'],
  ): ConflictException {
    return new ConflictException({
      code: 'INVALID_STATUS_TRANSITION',
      message: `주문 상태를 ${from}에서 ${to}(으)로 변경할 수 없습니다.`,
    });
  }

  private createInvalidShipmentStateException(message: string): ConflictException {
    return new ConflictException({
      code: 'INVALID_SHIPMENT_STATE',
      message,
    });
  }

  private shouldDispatchShipmentEventForStatus(
    status: AdminOrderMutationRecord['orderStatus'],
  ): boolean {
    return status === 'PREPARING' || status === 'SHIPPED' || status === 'DELIVERED';
  }
}
