import { ShipmentStatus } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';

import {
  buildShipmentEventDescription,
  buildTrackingEvents,
  buildTrackingUrl,
  getOrderTrackingLabel,
  getShipmentSnapshot,
} from './order-tracking';

describe('order tracking helpers', () => {
  it('builds tracking urls only when tracking number exists', () => {
    expect(buildTrackingUrl(null)).toBeNull();
    expect(buildTrackingUrl('123/456')).toBe('https://tracker.example.com/123%2F456');
  });

  it('returns a ready shipment snapshot when shipment does not exist', () => {
    expect(
      getShipmentSnapshot({
        createdAt: new Date('2026-04-24T00:00:00.000Z'),
        statusHistories: [],
        shipment: null,
      }),
    ).toEqual({
      shipmentStatus: ShipmentStatus.READY,
      courierName: null,
      trackingNumber: null,
      trackingUrl: null,
      shippedAt: null,
      deliveredAt: null,
    });
  });

  it('builds ordered tracking events and fills shipment-only events', () => {
    const events = buildTrackingEvents({
      createdAt: new Date('2026-04-24T00:00:00.000Z'),
      statusHistories: [
        {
          newStatus: 'PAYMENT_REQUESTED',
          changeReason: '입금 요청 접수',
          createdAt: new Date('2026-04-24T01:00:00.000Z'),
        },
      ],
      shipment: {
        shipmentStatus: ShipmentStatus.SHIPPED,
        courierName: 'CJ대한통운',
        trackingNumber: '1234567890',
        shippedAt: new Date('2026-04-24T03:00:00.000Z'),
        deliveredAt: null,
      },
    });

    expect(events).toEqual([
      {
        source: 'ORDER',
        status: 'PENDING_PAYMENT',
        label: '주문 접수',
        occurredAt: '2026-04-24T00:00:00.000Z',
        description: '주문이 접수되었습니다.',
      },
      {
        source: 'ORDER',
        status: 'PAYMENT_REQUESTED',
        label: '입금 요청 확인 중',
        occurredAt: '2026-04-24T01:00:00.000Z',
        description: '입금 요청 접수',
      },
      {
        source: 'SHIPMENT',
        status: 'SHIPPED',
        label: '배송 시작',
        occurredAt: '2026-04-24T03:00:00.000Z',
        description: 'CJ대한통운 / 1234567890',
      },
    ]);
  });

  it('does not duplicate shipment events already present in order history', () => {
    const events = buildTrackingEvents({
      createdAt: new Date('2026-04-24T00:00:00.000Z'),
      statusHistories: [
        {
          newStatus: 'SHIPPED',
          changeReason: '관리자 배송 처리',
          createdAt: new Date('2026-04-24T03:00:00.000Z'),
        },
      ],
      shipment: {
        shipmentStatus: ShipmentStatus.SHIPPED,
        courierName: 'CJ대한통운',
        trackingNumber: '1234567890',
        shippedAt: new Date('2026-04-24T03:00:00.000Z'),
        deliveredAt: null,
      },
    });

    expect(events.filter((event) => event.status === 'SHIPPED')).toHaveLength(1);
  });

  it('maps tracking labels and shipment descriptions', () => {
    expect(getOrderTrackingLabel('DELIVERED')).toBe('배송 완료');
    expect(
      buildShipmentEventDescription({
        shipmentStatus: ShipmentStatus.SHIPPED,
        courierName: 'CJ대한통운',
        trackingNumber: '1234567890',
        shippedAt: null,
        deliveredAt: null,
      }),
    ).toBe('CJ대한통운 / 1234567890');
  });
});
