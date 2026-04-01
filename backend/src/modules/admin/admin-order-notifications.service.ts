import { Injectable } from '@nestjs/common';

import { OrderNotificationsService } from '../notifications/order-notifications.service';
import type {
  OrderShipmentUpdatedEvent as AdminOrderShipmentUpdatedEvent,
  OrderStatusChangedEvent as AdminOrderStatusChangedEvent,
} from '../notifications/order-notification.events';

@Injectable()
export class AdminOrderNotificationsService {
  constructor(private readonly orderNotifications: OrderNotificationsService) {}

  notifyOrderStatusChanged(event: AdminOrderStatusChangedEvent): void {
    this.orderNotifications.notifyOrderStatusChanged(event);
  }

  notifyOrderShipmentUpdated(event: AdminOrderShipmentUpdatedEvent): void {
    this.orderNotifications.notifyOrderShipmentUpdated(event);
  }
}
