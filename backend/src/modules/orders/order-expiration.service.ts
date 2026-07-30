import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { OrderNotificationsService } from '../notifications/order-notifications.service';

const ORDER_EXPIRATION_REASON = '입금 기한 만료(시스템)';

export type ExpireDueOrdersResult = {
  expiredOrderCount: number;
  processedAt: string;
};

type ExpiredOrderEvent = {
  orderId: number;
  orderNumber: string;
};

@Injectable()
export class OrderExpirationService {
  private readonly logger = new Logger(OrderExpirationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderNotifications: OrderNotificationsService,
  ) {}

  // 입금 기한을 넘긴 미입금 주문만 EXPIRED로 전환하고, 시스템 상태 이력과 알림 이벤트를 남긴다.
  async expireDueOrders(now = new Date()): Promise<ExpireDueOrdersResult> {
    const dueOrders = await this.prisma.order.findMany({
      where: {
        orderStatus: OrderStatus.PENDING_PAYMENT,
        depositDeadlineAt: {
          lte: now,
        },
      },
      select: {
        id: true,
        orderNumber: true,
      },
      orderBy: [{ depositDeadlineAt: 'asc' }, { id: 'asc' }],
    });

    const expiredOrders: ExpiredOrderEvent[] = [];

    for (const dueOrder of dueOrders) {
      const expiredOrder = await this.expireOrderIfStillDue(dueOrder, now);
      if (expiredOrder) {
        expiredOrders.push(expiredOrder);
      }
    }

    for (const expiredOrder of expiredOrders) {
      this.orderNotifications.notifyOrderStatusChanged({
        orderId: expiredOrder.orderId,
        orderNumber: expiredOrder.orderNumber,
        previousStatus: OrderStatus.PENDING_PAYMENT,
        newStatus: OrderStatus.EXPIRED,
        adminId: 0,
        changeReason: ORDER_EXPIRATION_REASON,
      });
    }

    this.logger.log(
      `order expiration completed expiredOrderCount=${expiredOrders.length} processedAt=${now.toISOString()}`,
    );

    return {
      expiredOrderCount: expiredOrders.length,
      processedAt: now.toISOString(),
    };
  }

  private async expireOrderIfStillDue(
    dueOrder: { id: bigint; orderNumber: string },
    now: Date,
  ): Promise<ExpiredOrderEvent | null> {
    return this.prisma.$transaction(async (tx) => {
      // 상태를 다시 조건에 넣어 Cron 중복 실행이나 관리자 입금 확인과의 경쟁 상태를 막는다.
      const updated = await tx.order.updateMany({
        where: {
          id: dueOrder.id,
          orderStatus: OrderStatus.PENDING_PAYMENT,
          depositDeadlineAt: {
            lte: now,
          },
        },
        data: {
          orderStatus: OrderStatus.EXPIRED,
          expiredAt: now,
        },
      });

      if (updated.count === 0) {
        return null;
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId: dueOrder.id,
          adminId: null,
          previousStatus: OrderStatus.PENDING_PAYMENT,
          newStatus: OrderStatus.EXPIRED,
          changeReason: ORDER_EXPIRATION_REASON,
        },
      });

      return {
        orderId: Number(dueOrder.id),
        orderNumber: dueOrder.orderNumber,
      };
    });
  }
}
