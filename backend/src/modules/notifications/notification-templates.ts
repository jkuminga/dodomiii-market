import type { OrderStatus } from '@prisma/client';

export type OrderItemTemplateData = {
  productName: string;
  optionLabel: string | null;
  quantity: number;
  lineTotalPrice: number;
};

export type OrderTemplateContext = {
  orderNumber: string;
  orderStatus: OrderStatus;
  createdAt: string;
  totalProductPrice: number;
  shippingFee: number;
  finalTotalPrice: number;
  customerRequest: string | null;
  buyerName: string | null;
  buyerPhone: string | null;
  receiverName: string | null;
  receiverPhone: string | null;
  courierName: string | null;
  trackingNumber: string | null;
  shipmentStatus: 'READY' | 'SHIPPED' | 'DELIVERED' | null;
  items: OrderItemTemplateData[];
};

export type RenderedEmail = {
  subject: string;
  text: string;
  html: string;
};

export type AdminStatusSummaryContext = {
  order: OrderTemplateContext;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  changedByAdminName: string | null;
  changedByAdminLoginId: string | null;
  changeReason: string | null;
};

export type AdminShipmentSummaryContext = {
  order: OrderTemplateContext;
  adminName: string | null;
  adminLoginId: string | null;
  shipmentStatus: 'READY' | 'SHIPPED' | 'DELIVERED';
};

// 입금 확인 요청을 접수한 주문자에게 보내는 안내 정보다.
export type CustomerDepositRequestedContext = {
  orderNumber: string;
  depositorName: string | null;
  requestedAt: string;
};

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: '입금 대기',
  PAYMENT_CONFIRMED: '입금 확인 완료',
  PREPARING: '상품 준비 중',
  SHIPPED: '배송 중',
  DELIVERED: '배송 완료',
  CANCELLED: '주문 취소',
  EXPIRED: '주문 만료',
};

const SHIPMENT_STATUS_LABELS: Record<'READY' | 'SHIPPED' | 'DELIVERED', string> = {
  READY: '배송 준비',
  SHIPPED: '배송 중',
  DELIVERED: '배송 완료',
};

const SEOUL_TIME_ZONE = 'Asia/Seoul';
const CURRENCY = new Intl.NumberFormat('ko-KR');

const formatCurrency = (value: number): string => `${CURRENCY.format(value)}원`;

const formatDateTime = (value: string): string =>
  new Intl.DateTimeFormat('ko-KR', {
    timeZone: SEOUL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const renderOrderItemsText = (items: OrderItemTemplateData[]): string => {
  if (items.length === 0) {
    return '- 커스텀 주문';
  }

  return items
    .map((item) => {
      const optionSegment = item.optionLabel ? ` (${item.optionLabel})` : '';

      return `- ${item.productName}${optionSegment} x${item.quantity} / ${formatCurrency(item.lineTotalPrice)}`;
    })
    .join('\n');
};

const renderOrderItemsHtml = (items: OrderItemTemplateData[]): string => {
  if (items.length === 0) {
    return '<li>커스텀 주문</li>';
  }

  return items
    .map((item) => {
      const optionSegment = item.optionLabel ? ` (${escapeHtml(item.optionLabel)})` : '';

      return `<li>${escapeHtml(item.productName)}${optionSegment} x${item.quantity} / ${escapeHtml(formatCurrency(item.lineTotalPrice))}</li>`;
    })
    .join('');
};

const formatOrderStatus = (status: OrderStatus): string => ORDER_STATUS_LABELS[status];
const formatShipmentStatus = (status: 'READY' | 'SHIPPED' | 'DELIVERED'): string => SHIPMENT_STATUS_LABELS[status];

// To 관리자: 신규 주문 생성 이메일
export const renderAdminNewOrderEmail = (order: OrderTemplateContext): RenderedEmail => {
  const subject = `[신규 주문] ${order.orderNumber}`;
  const text = [
    `${order.orderNumber} 신규 주문이 접수되었습니다.`,
    '',
    `주문 시각: ${formatDateTime(order.createdAt)}`,
    `주문 상태: ${formatOrderStatus(order.orderStatus)}`,
    `구매자: ${order.buyerName ?? '-'} / ${order.buyerPhone ?? '-'}`,
    `수령인: ${order.receiverName ?? '-'} / ${order.receiverPhone ?? '-'}`,
    `상품 금액: ${formatCurrency(order.totalProductPrice)}`,
    `배송비: ${formatCurrency(order.shippingFee)}`,
    `최종 금액: ${formatCurrency(order.finalTotalPrice)}`,
    `고객 요청사항: ${order.customerRequest ?? '-'}`,
    '',
    '주문 항목',
    renderOrderItemsText(order.items),
  ].join('\n');
  const html = `
    <h1>${escapeHtml(order.orderNumber)} 신규 주문</h1>
    <p>주문 시각: ${escapeHtml(formatDateTime(order.createdAt))}</p>
    <p>주문 상태: ${escapeHtml(formatOrderStatus(order.orderStatus))}</p>
    <p>구매자: ${escapeHtml(order.buyerName ?? '-')} / ${escapeHtml(order.buyerPhone ?? '-')}</p>
    <p>수령인: ${escapeHtml(order.receiverName ?? '-')} / ${escapeHtml(order.receiverPhone ?? '-')}</p>
    <p>상품 금액: ${escapeHtml(formatCurrency(order.totalProductPrice))}</p>
    <p>배송비: ${escapeHtml(formatCurrency(order.shippingFee))}</p>
    <p>최종 금액: ${escapeHtml(formatCurrency(order.finalTotalPrice))}</p>
    <p>고객 요청사항: ${escapeHtml(order.customerRequest ?? '-')}</p>
    <h2>주문 항목</h2>
    <ul>${renderOrderItemsHtml(order.items)}</ul>
  `.trim();

  return { subject, text, html };
};

// To 관리자: 신규 주문 생성 SMS
export const renderAdminNewOrderSms = (order: OrderTemplateContext): string =>
  `[도도미마켓 - 신규 주문]\n◼︎주문 번호 : ${order.orderNumber}\n◼︎구매인 성함 : ${order.buyerName ?? '-'}\n◼︎금액 : ${formatCurrency(order.finalTotalPrice)}\n◼︎상태 : ${formatOrderStatus(order.orderStatus)}`;

// To 주문자: 신규 주문 생성 SMS
export const renderCustomerNewOrderSms = (order: OrderTemplateContext): string =>
  [
    '[도도미마켓]',
    `◼︎주문 번호 : ${order.orderNumber}`,
    `◼︎주문자 : ${order.buyerName ?? '-'}`,
    `◼︎결제 예정 금액 : ${formatCurrency(order.finalTotalPrice)}`,
    '◼︎주문이 생성되었습니다.',
    '◼︎입금 확인까지 최대 2일이 소요될 수 있습니다.',
  ].join('\n');

// To 주문자: 입금 확인 요청 접수 SMS
export const renderCustomerDepositRequestedSms = (context: CustomerDepositRequestedContext): string =>
  [
    '[도도미마켓]',
    `◼︎주문 번호 : ${context.orderNumber}`,
    `◼︎입금자 : ${context.depositorName ?? '-'}`,
    `◼︎요청 시각 : ${formatDateTime(context.requestedAt)}`,
    '◼︎주문이 생성되었습니다.',
    '◼︎입금 확인까지 최대 2일이 소요될 수 있습니다.',
  ].join('\n');

// 주문 상태별 주문자 안내 문구. 상태 코드(B)를 단일 기준으로 사용한다.
const CUSTOMER_ORDER_STATUS_MESSAGES: Record<OrderStatus, string> = {
  PENDING_PAYMENT: '입금 정보를 확인한 뒤 입금을 완료해 주세요.',
  PAYMENT_CONFIRMED: '입금이 확인되었습니다. 상품을 준비하겠습니다.',
  PREPARING: '주문하신 상품을 정성껏 준비하고 있습니다.',
  SHIPPED: '상품이 발송되었습니다. 배송 정보를 확인해 주세요.',
  DELIVERED: '주문하신 상품의 배송이 완료되었습니다.',
  CANCELLED: '주문이 취소되었습니다. 환불 안내를 확인해 주세요.',
  EXPIRED: '입금 기한이 지나 주문이 만료되었습니다.',
};

// To 구매자: 주문 상태 변경 SMS
export const renderCustomerOrderStatusSms = (
  order: OrderTemplateContext,
  _previousStatus: OrderStatus,
  newStatus: OrderStatus,
  orderStatusUrl: string | null = null,
): string => {
  const lines = [
    `[도도미마켓]`,
    `◼︎주문 번호 : ${order.orderNumber}`,
    `◼︎(${newStatus} 상태로 변경되었습니다)`,
    `◼︎${CUSTOMER_ORDER_STATUS_MESSAGES[newStatus]}`,
  ];

  if (order.shipmentStatus === 'SHIPPED' || order.shipmentStatus === 'DELIVERED') {
    lines.push(`◼︎배송 상태 : ${formatShipmentStatus(order.shipmentStatus)}`);
  }

  if (order.courierName && order.trackingNumber) {
    lines.push(`◼︎${order.courierName} ${order.trackingNumber}`);
  }

  if (orderStatusUrl) {
    lines.push(`◼︎주문 조회 : ${orderStatusUrl}`);
  }

  return lines.join('\n');
};

// To 관리자: 주문 상태 변경 요약 이메일
export const renderAdminOrderStatusEmail = (
  context: AdminStatusSummaryContext,
): RenderedEmail => {
  const subject = `[주문 상태 변경] ${context.order.orderNumber}`;
  const actor =
    context.changedByAdminName ??
    context.changedByAdminLoginId ??
    `admin:${context.order.orderNumber}`;
  const text = [
    `${context.order.orderNumber} 주문 상태가 변경되었습니다.`,
    '',
    `변경자: ${actor}`,
    `이전 상태: ${formatOrderStatus(context.previousStatus)}`,
    `현재 상태: ${formatOrderStatus(context.newStatus)}`,
    `변경 사유: ${context.changeReason ?? '-'}`,
    `구매자: ${context.order.buyerName ?? '-'} / ${context.order.buyerPhone ?? '-'}`,
    `최종 금액: ${formatCurrency(context.order.finalTotalPrice)}`,
  ].join('\n');
  const html = `
    <h1>${escapeHtml(context.order.orderNumber)} 주문 상태 변경</h1>
    <p>변경자: ${escapeHtml(actor)}</p>
    <p>이전 상태: ${escapeHtml(formatOrderStatus(context.previousStatus))}</p>
    <p>현재 상태: ${escapeHtml(formatOrderStatus(context.newStatus))}</p>
    <p>변경 사유: ${escapeHtml(context.changeReason ?? '-')}</p>
    <p>구매자: ${escapeHtml(context.order.buyerName ?? '-')} / ${escapeHtml(
      context.order.buyerPhone ?? '-',
    )}</p>
    <p>최종 금액: ${escapeHtml(formatCurrency(context.order.finalTotalPrice))}</p>
  `.trim();

  return { subject, text, html };
};

// To 관리자: 주문 상태 변경 요약 SMS
export const renderAdminOrderStatusSms = (context: AdminStatusSummaryContext): string =>
  `[도도미마켓 - 주문 상태 변경]\n ◼︎주문 번호 : ${context.order.orderNumber}\n ◼︎상태 : ${formatOrderStatus(context.previousStatus)} > ${formatOrderStatus(context.newStatus)}\n ◼︎구매자 : ${context.order.buyerName ?? '-'}\n ◼︎사유 : ${context.changeReason ?? '-'}`;

// To 관리자: 배송 정보 업데이트 이메일
export const renderAdminShipmentUpdatedEmail = (
  context: AdminShipmentSummaryContext,
): RenderedEmail => {
  const subject = `[배송 정보 업데이트] ${context.order.orderNumber}`;
  const actor =
    context.adminName ?? context.adminLoginId ?? `admin:${context.order.orderNumber}`;
  const text = [
    `${context.order.orderNumber} 배송 정보가 업데이트되었습니다.`,
    '',
    `변경자: ${actor}`,
    `주문 상태: ${formatOrderStatus(context.order.orderStatus)}`,
    `배송 상태: ${formatShipmentStatus(context.shipmentStatus)}`,
    `택배사: ${context.order.courierName ?? '-'}`,
    `운송장: ${context.order.trackingNumber ?? '-'}`,
  ].join('\n');
  const html = `
    <h1>${escapeHtml(context.order.orderNumber)} 배송 정보 업데이트</h1>
    <p>변경자: ${escapeHtml(actor)}</p>
    <p>주문 상태: ${escapeHtml(formatOrderStatus(context.order.orderStatus))}</p>
    <p>배송 상태: ${escapeHtml(formatShipmentStatus(context.shipmentStatus))}</p>
    <p>택배사: ${escapeHtml(context.order.courierName ?? '-')}</p>
    <p>운송장: ${escapeHtml(context.order.trackingNumber ?? '-')}</p>
  `.trim();

  return { subject, text, html };
};

// To 관리자: 배송 정보 업데이트 SMS
export const renderAdminShipmentUpdatedSms = (
  context: AdminShipmentSummaryContext,
): string =>
  `[도도미마켓] 배송 업데이트 ${context.order.orderNumber}\n상태 ${formatShipmentStatus(
    context.shipmentStatus,
  )}\n${context.order.courierName ?? '-'} ${context.order.trackingNumber ?? '-'}`;

export const notificationTemplateUtils = {
  formatCurrency,
  formatDateTime,
  formatOrderStatus,
  formatShipmentStatus,
};
