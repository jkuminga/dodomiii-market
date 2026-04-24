import { ShipmentStatus, type OrderStatus } from '@prisma/client';

import type { StoreTrackingEvent } from '../store.types';

const TRACKING_BASE_URL = 'https://tracker.example.com';

export type StoreOrderTrackingInput = {
  createdAt: Date;
  statusHistories: Array<{
    newStatus: OrderStatus;
    changeReason: string | null;
    createdAt: Date;
  }>;
  shipment: {
    shipmentStatus: ShipmentStatus;
    courierName: string | null;
    trackingNumber: string | null;
    shippedAt: Date | null;
    deliveredAt: Date | null;
  } | null;
};

export function buildTrackingUrl(trackingNumber: string | null): string | null {
  if (!trackingNumber) {
    return null;
  }

  return `${TRACKING_BASE_URL}/${encodeURIComponent(trackingNumber)}`;
}

export function getShipmentSnapshot(order: StoreOrderTrackingInput) {
  return {
    shipmentStatus: order.shipment?.shipmentStatus ?? ShipmentStatus.READY,
    courierName: order.shipment?.courierName ?? null,
    trackingNumber: order.shipment?.trackingNumber ?? null,
    trackingUrl: buildTrackingUrl(order.shipment?.trackingNumber ?? null),
    shippedAt: order.shipment?.shippedAt ? order.shipment.shippedAt.toISOString() : null,
    deliveredAt: order.shipment?.deliveredAt ? order.shipment.deliveredAt.toISOString() : null,
  };
}

export function buildTrackingEvents(order: StoreOrderTrackingInput): StoreTrackingEvent[] {
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
      label: getOrderTrackingLabel(history.newStatus),
      occurredAt: history.createdAt.toISOString(),
      description: history.changeReason,
    })),
  ];

  const hasShippedEvent = order.statusHistories.some((history) => history.newStatus === 'SHIPPED');
  const hasDeliveredEvent = order.statusHistories.some((history) => history.newStatus === 'DELIVERED');
  const shipmentDescription = buildShipmentEventDescription(order.shipment);

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

export function buildShipmentEventDescription(
  shipment: StoreOrderTrackingInput['shipment'],
): string | null {
  if (!shipment) {
    return null;
  }

  const parts = [shipment.courierName, shipment.trackingNumber].filter(
    (value): value is string => Boolean(value),
  );

  return parts.length > 0 ? parts.join(' / ') : null;
}

export function getOrderTrackingLabel(status: OrderStatus): string {
  switch (status) {
    case 'PENDING_PAYMENT':
      return '주문 접수';
    case 'PAYMENT_REQUESTED':
      return '입금 요청 확인 중';
    case 'PAYMENT_CONFIRMED':
      return '입금 확인 완료';
    case 'PREPARING':
      return '상품 준비 중';
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
