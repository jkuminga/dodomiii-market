import type { DepositStatus, OrderStatus, ShipmentStatus } from '@prisma/client';

export type StoreOrderItemSnapshot = {
  productNameSnapshot: string;
  optionNameSnapshot: string | null;
  optionValueSnapshot: string | null;
  unitPrice: number;
  quantity: number;
  lineTotalPrice: number;
};

export type StoreOrderContact = {
  buyerName: string;
  buyerPhone: string;
  receiverName: string;
  receiverPhone: string;
  zipcode: string;
  address1: string;
  address2: string | null;
};

export type StoreOrderPricing = {
  totalProductPrice: number;
  shippingFee: number;
  finalTotalPrice: number;
};

export type StoreOrderDepositInfo = {
  depositStatus: DepositStatus;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  expectedAmount: number;
  depositorName: string | null;
  requestedAt: string | null;
  confirmedAt: string | null;
  depositDeadlineAt: string | null;
  adminMemo: string | null;
};

export type StoreOrderShipmentInfo = {
  shipmentStatus: ShipmentStatus;
  courierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
};

export type StoreTrackingEvent = {
  source: 'ORDER' | 'SHIPMENT';
  status: OrderStatus | ShipmentStatus;
  label: string;
  occurredAt: string;
  description: string | null;
};

export type StoreOrderDetailResponse = {
  orderNumber: string;
  orderStatus: OrderStatus;
  customerRequest: string | null;
  items: StoreOrderItemSnapshot[];
  contact: StoreOrderContact;
  pricing: StoreOrderPricing;
  deposit: StoreOrderDepositInfo;
  shipment: StoreOrderShipmentInfo;
  trackingEvents: StoreTrackingEvent[];
  createdAt: string;
  updatedAt: string;
};

export type StoreDepositRequestResponse = {
  orderNumber: string;
  orderStatus: OrderStatus;
  depositStatus: DepositStatus;
  requestedAt: string | null;
  confirmedAt: string | null;
  requestAccepted: boolean;
};

export type StoreOrderTrackingResponse = {
  orderNumber: string;
  orderStatus: OrderStatus;
  shipmentStatus: ShipmentStatus;
  courierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  events: StoreTrackingEvent[];
};

export type StoreCustomCheckoutResponse = {
  token: string;
  productName: string;
  totalProductPrice: number;
  shippingFee: number;
  finalTotalPrice: number;
  expiresAt: string;
  isExpired: boolean;
  isAvailable: boolean;
};
