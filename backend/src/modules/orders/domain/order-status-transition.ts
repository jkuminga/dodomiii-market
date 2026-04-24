export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAYMENT_REQUESTED'
  | 'PAYMENT_CONFIRMED'
  | 'PREPARING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'EXPIRED';

const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['PAYMENT_REQUESTED', 'EXPIRED', 'CANCELLED'],
  PAYMENT_REQUESTED: ['PAYMENT_CONFIRMED', 'CANCELLED'],
  PAYMENT_CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
  EXPIRED: [],
};

// 현재 상태(From)에서 목표 상태(To)로 변경 가능한지 확인
export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_STATUS_TRANSITIONS[from].includes(to);
}

// 현재 상태(From)에서 목표 상태(To)로 변경 가능한지 확인하고, 불가능하면 에러 발생
export function assertOrderStatusTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrderStatus(from, to)) {
    throw new Error(`INVALID_STATUS_TRANSITION: ${from} -> ${to}`);
  }
}

// 현재 상태(From)에서 변경 가능한 목표 상태(To) 목록 반환
export function getAllowedNextOrderStatuses(from: OrderStatus): OrderStatus[] {
  return [...ALLOWED_STATUS_TRANSITIONS[from]];
}
