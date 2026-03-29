import { Injectable, Logger } from '@nestjs/common';
import type { OrderStatus, ShipmentStatus } from '@prisma/client';

type AdminOrderStatusChangedEvent = {
  orderId: number;
  orderNumber: string;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  adminId: number;
  changeReason: string | null;
};

type AdminOrderShipmentUpdatedEvent = {
  orderId: number;
  orderNumber: string;
  orderStatus: OrderStatus;
  shipmentStatus: ShipmentStatus;
  adminId: number;
};

@Injectable()
export class AdminOrderNotificationsService {
  private readonly logger = new Logger(AdminOrderNotificationsService.name);

  async notifyOrderStatusChanged(event: AdminOrderStatusChangedEvent): Promise<void> {
    this.logger.debug(
      `order-status-changed orderId=${event.orderId} orderNumber=${event.orderNumber} previousStatus=${event.previousStatus} newStatus=${event.newStatus} adminId=${event.adminId}`,
    );
  }

  async notifyOrderShipmentUpdated(event: AdminOrderShipmentUpdatedEvent): Promise<void> {
    this.logger.debug(
      `order-shipment-updated orderId=${event.orderId} orderNumber=${event.orderNumber} orderStatus=${event.orderStatus} shipmentStatus=${event.shipmentStatus} adminId=${event.adminId}`,
    );
  }
}
