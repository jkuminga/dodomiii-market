import { describe, expect, it } from '@jest/globals';
import type { OrderTemplateContext } from './notification-templates';
import {
  notificationTemplateUtils,
  renderAdminNewOrderEmail,
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
    expect(message).toContain('◼︎주문자 : 홍길동');
    expect(message).toContain('◼︎결제 예정 금액 : 62,000원');
    expect(message).toContain('◼︎주문이 생성되었습니다.');
  });

  it('adds shipment details to customer status sms only when shipment data is available', () => {
    const preparingMessage = renderCustomerOrderStatusSms(
      baseOrder,
      'PAYMENT_CONFIRMED',
      'PREPARING',
    );
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

    expect(preparingMessage).not.toContain('배송 상태');
    expect(shippedMessage).toContain('◼︎배송 상태 : 배송 중');
    expect(shippedMessage).toContain('◼︎CJ대한통운 1234567890');
    expect(shippedMessage).toContain('◼︎주문 조회 : https://shop.example.test/orders/D20260424-0001');
  });

  it.each([
    ['PENDING_PAYMENT', '입금 정보를 확인한 뒤 입금을 완료해 주세요.'],
    ['PAYMENT_CONFIRMED', '입금이 확인되었습니다. 상품을 준비하겠습니다.'],
    ['PREPARING', '주문하신 상품을 정성껏 준비하고 있습니다.'],
    ['SHIPPED', '상품이 발송되었습니다. 배송 정보를 확인해 주세요.'],
    ['DELIVERED', '주문하신 상품의 배송이 완료되었습니다.'],
    ['CANCELLED', '주문이 취소되었습니다. 환불 안내를 확인해 주세요.'],
    ['EXPIRED', '입금 기한이 지나 주문이 만료되었습니다.'],
  ] as const)('renders the customer template for %s', (newStatus, expectedMessage) => {
    const message = renderCustomerOrderStatusSms(baseOrder, 'PENDING_PAYMENT', newStatus);

    expect(message).toContain(`◼︎(${newStatus} 상태로 변경되었습니다)`);
    expect(message).toContain(`◼︎${expectedMessage}`);
  });

  it('exposes stable formatting helpers for shared status labels', () => {
    expect(notificationTemplateUtils.formatCurrency(1234567)).toBe('1,234,567원');
    expect(notificationTemplateUtils.formatOrderStatus('PAYMENT_CONFIRMED')).toBe('입금 확인 완료');
    expect(notificationTemplateUtils.formatShipmentStatus('DELIVERED')).toBe('배송 완료');
  });
});
