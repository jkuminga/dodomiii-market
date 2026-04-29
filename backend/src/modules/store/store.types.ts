import type { DepositStatus, OrderStatus, ShipmentStatus, UserWebFontSize } from '@prisma/client';

export type StoreOrderItemSnapshot = {
  productNameSnapshot: string;
  thumbnailImageUrl: string | null;
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

export type StoreHomePopupResponse = {
  id: number;
  title: string | null;
  imageUrl: string;
  linkUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StoreHomeHeroResponse = {
  imageUrl: string;
  updatedAt: string;
};

export type StorefrontSettingsResponse = {
  userWebFontSize: UserWebFontSize;
  updatedAt: string;
};

export type StoreNoticeContentBlock =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'image';
      imageUrl: string;
      alt: string | null;
      caption: string | null;
    };

export type StoreNoticeListItemResponse = {
  id: number;
  title: string;
  summary: string | null;
  isPinned: boolean;
  thumbnailImageUrl: string | null;
  publishedAt: string;
};

export type StoreNoticeDetailResponse = {
  id: number;
  title: string;
  summary: string | null;
  contentJson: {
    version: number;
    blocks: StoreNoticeContentBlock[];
  };
  isPinned: boolean;
  thumbnailImageUrl: string | null;
  publishedAt: string;
  updatedAt: string;
};
