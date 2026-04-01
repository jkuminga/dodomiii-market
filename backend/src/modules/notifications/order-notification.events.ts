import type { OrderStatus, ShipmentStatus } from '@prisma/client';

export type NewOrderCreatedEvent = {
  orderId: number;
  orderNumber: string;
};

export type OrderStatusChangedEvent = {
  orderId: number;
  orderNumber: string;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  adminId: number;
  changeReason: string | null;
};

export type OrderShipmentUpdatedEvent = {
  orderId: number;
  orderNumber: string;
  orderStatus: OrderStatus;
  shipmentStatus: ShipmentStatus;
  adminId: number;
};

export type DepositRequestCreatedEvent = {
  orderId: number;
  orderNumber: string;
};
