import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { EmailNotificationService } from './email-notification.service';
import {
  renderAdminDepositRequestedSms,
  renderAdminNewOrderEmail,
  renderAdminNewOrderSms,
  renderAdminOrderStatusEmail,
  renderAdminOrderStatusSms,
  renderAdminShipmentUpdatedEmail,
  renderAdminShipmentUpdatedSms,
  renderCustomerOrderStatusSms,
  type OrderTemplateContext,
} from './notification-templates';
import type {
  DepositRequestCreatedEvent,
  NewOrderCreatedEvent,
  OrderShipmentUpdatedEvent,
  OrderStatusChangedEvent,
} from './order-notification.events';
import { SmsNotificationService } from './sms-notification.service';

const orderNotificationArgs = Prisma.validator<Prisma.OrderDefaultArgs>()({
  select: {
    id: true,
    orderNumber: true,
    orderStatus: true,
    totalProductPrice: true,
    shippingFee: true,
    finalTotalPrice: true,
    customerRequest: true,
    createdAt: true,
    contact: {
      select: {
        buyerName: true,
        buyerPhone: true,
        receiverName: true,
        receiverPhone: true,
      },
    },
    items: {
      orderBy: [{ id: 'asc' }],
      select: {
        productNameSnapshot: true,
        optionNameSnapshot: true,
        optionValueSnapshot: true,
        quantity: true,
        lineTotalPrice: true,
      },
    },
    shipment: {
      select: {
        courierName: true,
        trackingNumber: true,
        shipmentStatus: true,
      },
    },
  },
});

type OrderNotificationRecord = Prisma.OrderGetPayload<typeof orderNotificationArgs>;

type AdminRecipient = {
  id: bigint;
  name: string;
  email: string | null;
  phone: string | null;
};

type AdminActor = {
  name: string | null;
  loginId: string | null;
};

type DeliveryTarget = {
  channel: 'email' | 'sms';
  recipient: string;
  execute: () => Promise<void>;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

@Injectable()
export class OrderNotificationsService {
  private readonly logger = new Logger(OrderNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailNotificationService,
    private readonly smsService: SmsNotificationService,
  ) {}

  notifyNewOrderCreated(event: NewOrderCreatedEvent): void {
    this.runInBackground(`new-order-created:${event.orderNumber}`, () =>
      this.handleNewOrderCreated(event),
    );
  }

  notifyOrderStatusChanged(event: OrderStatusChangedEvent): void {
    this.runInBackground(`order-status-changed:${event.orderNumber}`, () =>
      this.handleOrderStatusChanged(event),
    );
  }

  notifyOrderShipmentUpdated(event: OrderShipmentUpdatedEvent): void {
    this.runInBackground(`order-shipment-updated:${event.orderNumber}`, () =>
      this.handleOrderShipmentUpdated(event),
    );
  }

  notifyDepositRequested(event: DepositRequestCreatedEvent): void {
    this.runInBackground(`deposit-requested:${event.orderNumber}`, () =>
      this.handleDepositRequested(event),
    );
  }

  private runInBackground(label: string, task: () => Promise<void>): void {
    if (!this.configService.get<boolean>('NOTIFICATIONS_ENABLED', true)) {
      this.logger.debug(`notifications disabled label=${label}`);
      return;
    }

    setImmediate(() => {
      void task().catch((error: unknown) => {
        const message = error instanceof Error ? error.stack ?? error.message : String(error);
        this.logger.error(`notification job failed label=${label} ${message}`);
      });
    });
  }

  private async handleNewOrderCreated(event: NewOrderCreatedEvent): Promise<void> {
    const order = await this.findOrderForNotifications(event.orderId);
    if (!order) {
      this.logger.warn(`new-order notification skipped missing-order orderId=${event.orderId}`);
      return;
    }

    const adminRecipients = await this.findActiveAdminRecipients();
    const context = this.mapOrderTemplateContext(order);
    const email = renderAdminNewOrderEmail(context);
    const sms = renderAdminNewOrderSms(context);

    await this.deliverAll(
      [
        ...this.buildAdminEmailTargets(adminRecipients, email),
        ...this.buildAdminSmsTargets(adminRecipients, sms),
      ],
      {
        eventType: 'new-order-created',
        orderNumber: order.orderNumber,
      },
    );
  }

  private async handleOrderStatusChanged(event: OrderStatusChangedEvent): Promise<void> {
    const order = await this.findOrderForNotifications(event.orderId);
    if (!order) {
      this.logger.warn(`status notification skipped missing-order orderId=${event.orderId}`);
      return;
    }

    const context = this.mapOrderTemplateContext(order);
    const customerSms = renderCustomerOrderStatusSms(
      context,
      event.previousStatus,
      event.newStatus,
    );

    await this.deliverAll(
      this.buildCustomerSmsTargets(order, customerSms),
      {
        eventType: 'order-status-changed-customer',
        orderNumber: order.orderNumber,
      },
    );

    if (!this.configService.get<boolean>('NOTIFICATIONS_ADMIN_STATUS_SUMMARY_ENABLED', true)) {
      return;
    }

    const adminRecipients = await this.findActiveAdminRecipients();
    const actor = await this.findAdminActor(event.adminId);
    const email = renderAdminOrderStatusEmail({
      order: context,
      previousStatus: event.previousStatus,
      newStatus: event.newStatus,
      changedByAdminName: actor.name,
      changedByAdminLoginId: actor.loginId,
      changeReason: event.changeReason,
    });
    const sms = renderAdminOrderStatusSms({
      order: context,
      previousStatus: event.previousStatus,
      newStatus: event.newStatus,
      changedByAdminName: actor.name,
      changedByAdminLoginId: actor.loginId,
      changeReason: event.changeReason,
    });

    await this.deliverAll(
      [
        ...this.buildAdminEmailTargets(adminRecipients, email),
        ...this.buildAdminSmsTargets(adminRecipients, sms),
      ],
      {
        eventType: 'order-status-changed-admin-summary',
        orderNumber: order.orderNumber,
      },
    );
  }

  private async handleOrderShipmentUpdated(event: OrderShipmentUpdatedEvent): Promise<void> {
    if (!this.configService.get<boolean>('NOTIFICATIONS_ADMIN_STATUS_SUMMARY_ENABLED', true)) {
      return;
    }

    const order = await this.findOrderForNotifications(event.orderId);
    if (!order) {
      this.logger.warn(`shipment notification skipped missing-order orderId=${event.orderId}`);
      return;
    }

    const adminRecipients = await this.findActiveAdminRecipients();
    const actor = await this.findAdminActor(event.adminId);
    const context = this.mapOrderTemplateContext(order);
    const email = renderAdminShipmentUpdatedEmail({
      order: context,
      adminName: actor.name,
      adminLoginId: actor.loginId,
      shipmentStatus: event.shipmentStatus,
    });
    const sms = renderAdminShipmentUpdatedSms({
      order: context,
      adminName: actor.name,
      adminLoginId: actor.loginId,
      shipmentStatus: event.shipmentStatus,
    });

    await this.deliverAll(
      [
        ...this.buildAdminEmailTargets(adminRecipients, email),
        ...this.buildAdminSmsTargets(adminRecipients, sms),
      ],
      {
        eventType: 'order-shipment-updated-admin-summary',
        orderNumber: order.orderNumber,
      },
    );
  }

  private async handleDepositRequested(event: DepositRequestCreatedEvent): Promise<void> {
    const order = await this.findOrderForNotifications(event.orderId);
    if (!order) {
      this.logger.warn(`deposit notification skipped missing-order orderId=${event.orderId}`);
      return;
    }

    const adminRecipients = await this.findActiveAdminRecipients();
    const context = this.mapOrderTemplateContext(order);
    const sms = renderAdminDepositRequestedSms(context);

    await this.deliverAll(
      this.buildAdminSmsTargets(adminRecipients, sms),
      {
        eventType: 'deposit-requested-admin',
        orderNumber: order.orderNumber,
      },
    );
  }

  private async deliverAll(
    targets: DeliveryTarget[],
    context: {
      eventType: string;
      orderNumber: string;
    },
  ): Promise<void> {
    if (targets.length === 0) {
      this.logger.warn(
        `notification skipped no-recipients eventType=${context.eventType} orderNumber=${context.orderNumber}`,
      );
      return;
    }

    const results = await Promise.allSettled(
      targets.map((target) =>
        this.withRetry(
          context.eventType,
          context.orderNumber,
          target.channel,
          target.recipient,
          target.execute,
        ),
      ),
    );

    const failures = results.filter((result) => result.status === 'rejected').length;
    if (failures > 0) {
      this.logger.warn(
        `notification completed with failures eventType=${context.eventType} orderNumber=${context.orderNumber} failed=${failures} total=${results.length}`,
      );
      return;
    }

    this.logger.debug(
      `notification completed eventType=${context.eventType} orderNumber=${context.orderNumber} total=${results.length}`,
    );
  }

  private async withRetry(
    eventType: string,
    orderNumber: string,
    channel: 'email' | 'sms',
    recipient: string,
    operation: () => Promise<void>,
  ): Promise<void> {
    const attempts = Math.max(this.configService.get<number>('NOTIFICATIONS_RETRY_ATTEMPTS', 3), 1);
    const baseDelay = Math.max(
      this.configService.get<number>('NOTIFICATIONS_RETRY_BASE_DELAY_MS', 1000),
      0,
    );

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        await operation();
        if (attempt > 1) {
          this.logger.warn(
            `notification recovered eventType=${eventType} orderNumber=${orderNumber} channel=${channel} recipient=${recipient} attempt=${attempt}`,
          );
        }
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `notification send failed eventType=${eventType} orderNumber=${orderNumber} channel=${channel} recipient=${recipient} attempt=${attempt}/${attempts} error=${message}`,
        );

        if (attempt >= attempts) {
          throw error;
        }

        await sleep(baseDelay * attempt);
      }
    }
  }

  private async findOrderForNotifications(orderId: number): Promise<OrderNotificationRecord | null> {
    return this.prisma.order.findUnique({
      where: { id: BigInt(orderId) },
      ...orderNotificationArgs,
    });
  }

  private async findActiveAdminRecipients(): Promise<AdminRecipient[]> {
    return this.prisma.admin.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
      },
    });
  }

  private async findAdminActor(adminId: number): Promise<AdminActor> {
    const admin = await this.prisma.admin.findUnique({
      where: { id: BigInt(adminId) },
      select: {
        name: true,
        loginId: true,
      },
    });

    return {
      name: admin?.name ?? null,
      loginId: admin?.loginId ?? null,
    };
  }

  private buildAdminEmailTargets(
    admins: AdminRecipient[],
    message: { subject: string; text: string; html: string },
  ): DeliveryTarget[] {
    if (!this.emailService.isEnabled()) {
      this.logger.warn('email notifications disabled due to missing SMTP configuration');
      return [];
    }

    return this.uniqueValues(admins.map((admin) => admin.email)).map((recipient) => ({
      channel: 'email',
      recipient,
      execute: () =>
        this.emailService.send({
          to: recipient,
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
    }));
  }

  private buildAdminSmsTargets(admins: AdminRecipient[], message: string): DeliveryTarget[] {
    if (!this.smsService.isEnabled()) {
      this.logger.warn('sms notifications disabled due to missing SMS API configuration');
      return [];
    }

    return this.uniqueValues(admins.map((admin) => admin.phone)).map((recipient) => ({
      channel: 'sms',
      recipient,
      execute: () =>
        this.smsService.send({
          to: recipient,
          message,
        }),
    }));
  }

  private buildCustomerSmsTargets(
    order: OrderNotificationRecord,
    message: string,
  ): DeliveryTarget[] {
    if (!this.smsService.isEnabled()) {
      this.logger.warn('customer sms notifications disabled due to missing SMS API configuration');
      return [];
    }

    const recipients = this.uniqueValues([
      order.contact?.buyerPhone ?? null,
      order.contact?.receiverPhone ?? null,
    ]);

    return recipients.map((recipient) => ({
      channel: 'sms',
      recipient,
      execute: () =>
        this.smsService.send({
          to: recipient,
          message,
        }),
    }));
  }

  private mapOrderTemplateContext(order: OrderNotificationRecord): OrderTemplateContext {
    return {
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      createdAt: order.createdAt.toISOString(),
      totalProductPrice: order.totalProductPrice,
      shippingFee: order.shippingFee,
      finalTotalPrice: order.finalTotalPrice,
      customerRequest: order.customerRequest,
      buyerName: order.contact?.buyerName ?? null,
      buyerPhone: order.contact?.buyerPhone ?? null,
      receiverName: order.contact?.receiverName ?? null,
      receiverPhone: order.contact?.receiverPhone ?? null,
      courierName: order.shipment?.courierName ?? null,
      trackingNumber: order.shipment?.trackingNumber ?? null,
      shipmentStatus: order.shipment?.shipmentStatus ?? null,
      items: order.items.map((item) => ({
        productName: item.productNameSnapshot,
        optionLabel:
          item.optionNameSnapshot && item.optionValueSnapshot
            ? `${item.optionNameSnapshot}: ${item.optionValueSnapshot}`
            : item.optionValueSnapshot ?? item.optionNameSnapshot ?? null,
        quantity: item.quantity,
        lineTotalPrice: item.lineTotalPrice,
      })),
    };
  }

  private uniqueValues(values: Array<string | null | undefined>): string[] {
    const normalized = values
      .map((value) => value?.trim() ?? '')
      .filter((value) => value.length > 0);

    return [...new Set(normalized)];
  }
}
