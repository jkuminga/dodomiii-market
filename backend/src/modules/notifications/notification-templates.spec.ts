import { describe, expect, it } from '@jest/globals';
import type { OrderTemplateContext } from './notification-templates';
import {
  notificationTemplateUtils,
  isCustomerOrderStatusNotificationStatus,
  renderAdminNewOrderEmail,
  renderAdminNewOrderSms,
  renderCustomerDepositRequestedSms,
  renderCustomerNewOrderSms,
  renderCustomerOrderStatusSms,
} from './notification-templates';

const baseOrder: OrderTemplateContext = {
  orderNumber: 'D20260424-0001',
  orderStatus: 'PENDING_PAYMENT',
  createdAt: '2026-04-24T01:30:00.000Z',
  totalProductPrice: 59000,
  shippingFee: 3000,
  finalTotalPrice: 62000,
  customerRequest: null,
  buyerName: '홍길동',
  buyerPhone: '010-1234-5678',
  receiverName: '김수령',
  receiverPhone: '010-2222-3333',
  depositBankName: '농협',
  depositAccountHolder: '도도미마켓',
  depositAccountNumber: '302-2133-9597-21',
  depositDeadlineAt: '2026-04-25T14:59:59.000Z',
  courierName: null,
  trackingNumber: null,
  shipmentStatus: null,
  items: [
    {
      productName: '도도미 쌀',
      optionLabel: '2kg',
      quantity: 2,
      lineTotalPrice: 59000,
    },
  ],
};

describe('notification templates', () => {
  it('renders a new order email with escaped html and formatted amounts', () => {
    const email = renderAdminNewOrderEmail({
      ...baseOrder,
      buyerName: '<script>alert(1)</script>',
      items: [
        {
          productName: '도도미 <쌀>',
          optionLabel: '2kg & 선물',
          quantity: 1,
          lineTotalPrice: 62000,
        },
      ],
    });

    expect(email.subject).toBe('[신규 주문] D20260424-0001');
    expect(email.text).toContain('최종 금액: 62,000원');
    expect(email.text).toContain('- 도도미 <쌀> (2kg & 선물) x1 / 62,000원');
    expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(email.html).toContain('도도미 &lt;쌀&gt; (2kg &amp; 선물) x1 / 62,000원');
    expect(email.html).not.toContain('<script>alert(1)</script>');
  });

  it('renders a deposit request sms for the buyer', () => {
    const message = renderCustomerDepositRequestedSms({
      orderNumber: 'D20260424-0001',
      depositorName: '홍길동',
      requestedAt: '2026-04-24T01:30:00.000Z',
    });

    expect(message).toContain('[도도미마켓]');
    expect(message).toContain('◼︎주문 번호 : D20260424-0001');
    expect(message).toContain('◼︎입금자 : 홍길동');
    expect(message).toContain('◼︎주문이 생성되었습니다.');
    expect(message).toContain('◼︎입금 확인까지 최대 2일이 소요될 수 있습니다.');
  });

  it('renders a new order sms for the buyer', () => {
    const message = renderCustomerNewOrderSms(baseOrder);

    expect(message).toContain('[도도미마켓]');
    expect(message).toContain('◼︎주문 번호 : D20260424-0001');
    expect(message).toContain('고객님의 소중한 주문이 접수되었습니다 💛');
    expect(message).toContain('◼︎결제 금액 : 62,000원(배송비 포함)');
    expect(message).toContain('◼︎입금 계좌 : 농협 302-2133-9597-21');
    expect(message).toContain('(예금주 : 도도미마켓)');
    expect(message).toContain('주문해주셔서 감사합니다 🎀');
  });

  it('adds the admin order detail URL to the new-order admin sms', () => {
    const message = renderAdminNewOrderSms(
      baseOrder,
      'https://admin.example.test/admin/orders/123',
    );

    expect(message).toContain('◼︎관리자 주문 페이지 : https://admin.example.test/admin/orders/123');
  });

  it('renders a customer status sms when the order is shipped', () => {
    const shippedMessage = renderCustomerOrderStatusSms(
      {
        ...baseOrder,
        courierName: 'CJ대한통운',
        trackingNumber: '1234567890',
        shipmentStatus: 'SHIPPED',
      },
      'PREPARING',
      'SHIPPED',
      'https://shop.example.test/orders/D20260424-0001',
    );

    expect(shippedMessage).toContain('고객님의 주문 상품이 오늘 출고되었습니다.');
    expect(shippedMessage).toContain('◼︎주문 번호 : D20260424-0001');
    expect(shippedMessage).toContain('◼︎주문 조회 : https://shop.example.test/orders/D20260424-0001');
  });

  it('limits customer status notifications to the configured target statuses', () => {
    expect(isCustomerOrderStatusNotificationStatus('PENDING_PAYMENT')).toBe(false);
    expect(isCustomerOrderStatusNotificationStatus('PAYMENT_CONFIRMED')).toBe(false);
    expect(isCustomerOrderStatusNotificationStatus('PREPARING')).toBe(false);
    expect(isCustomerOrderStatusNotificationStatus('SHIPPED')).toBe(true);
    expect(isCustomerOrderStatusNotificationStatus('DELIVERED')).toBe(false);
    expect(isCustomerOrderStatusNotificationStatus('CANCELLED')).toBe(true);
    expect(isCustomerOrderStatusNotificationStatus('EXPIRED')).toBe(true);
  });

  it.each(['CANCELLED', 'EXPIRED'] as const)(
    'does not add an order lookup URL to the %s customer sms',
    (newStatus) => {
      const message = renderCustomerOrderStatusSms(
        baseOrder,
        'PENDING_PAYMENT',
        newStatus,
        'https://shop.example.test/orders/D20260424-0001',
      );

      expect(message).not.toContain('주문 조회');
      expect(message).not.toContain('shop.example.test');
    },
  );

  it('exposes stable formatting helpers for shared status labels', () => {
    expect(notificationTemplateUtils.formatCurrency(1234567)).toBe('1,234,567원');
    expect(notificationTemplateUtils.formatOrderStatus('PAYMENT_CONFIRMED')).toBe('입금 확인 완료');
    expect(notificationTemplateUtils.formatShipmentStatus('DELIVERED')).toBe('배송 완료');
  });
});
