import { describe, expect, it } from '@jest/globals';

import {
  assertOrderStatusTransition,
  canTransitionOrderStatus,
  getAllowedNextOrderStatuses,
} from './order-status-transition';

describe('order status transitions', () => {
  it('allows the expected customer order lifecycle', () => {
    expect(canTransitionOrderStatus('PENDING_PAYMENT', 'PAYMENT_REQUESTED')).toBe(true);
    expect(canTransitionOrderStatus('PAYMENT_REQUESTED', 'PAYMENT_CONFIRMED')).toBe(true);
    expect(canTransitionOrderStatus('PAYMENT_CONFIRMED', 'PREPARING')).toBe(true);
    expect(canTransitionOrderStatus('PREPARING', 'SHIPPED')).toBe(true);
    expect(canTransitionOrderStatus('SHIPPED', 'DELIVERED')).toBe(true);
  });

  it('blocks transitions from terminal statuses', () => {
    expect(canTransitionOrderStatus('DELIVERED', 'CANCELLED')).toBe(false);
    expect(canTransitionOrderStatus('CANCELLED', 'PENDING_PAYMENT')).toBe(false);
    expect(canTransitionOrderStatus('EXPIRED', 'PAYMENT_REQUESTED')).toBe(false);
  });

  // 현재 상태에서 목표 상태로 변경 가능한지 확인하고, 불가능하면 에러 발생
  it('throws with the attempted transition when a status change is invalid', () => {
    expect(() => assertOrderStatusTransition('PENDING_PAYMENT', 'SHIPPED')).toThrow(
      'INVALID_STATUS_TRANSITION: PENDING_PAYMENT -> SHIPPED',
    );
  });

  // 테스트의 목적 : 내부 로직이 안전하게 복사된 상태 배열을 반환하고 있는지
  // 만약 getAllowedNextOrderStatus에서 ALLOWED_STATUS_TRANSITIONS을 그대로
  // 리턴한다면, 이때 allowed는 실제 배열을 참조하게 되는 것이기 떄문에 
  // push를 하면 ALLOWED_STATUS_TRANSITIONS의 배열이 변경되어버림
  // 그렇기에 내부 로직이 [...]와 같은 안전한 복사된 배열을 반환하고 있는지 확인하는 테스트
  it('returns a defensive copy of allowed next statuses', () => {
    const allowed = getAllowedNextOrderStatuses('PENDING_PAYMENT');

    allowed.push('DELIVERED');

    expect(getAllowedNextOrderStatuses('PENDING_PAYMENT')).toEqual([
      'PAYMENT_REQUESTED',
      'EXPIRED',
      'CANCELLED',
    ]);
  });
});
