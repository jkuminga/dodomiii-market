import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';

import { buildDepositRequestReason, getDepositRequestDecision } from './deposit-request';

describe('deposit request helpers', () => {
  it('returns an already-handled decision for confirmed or already requested deposits', () => {
    expect(
      getDepositRequestDecision({
        orderStatus: 'PAYMENT_CONFIRMED',
        depositStatus: 'CONFIRMED',
      }),
    ).toEqual({
      requestAccepted: false,
      shouldTransitionOrder: false,
    });

    expect(
      getDepositRequestDecision({
        orderStatus: 'PAYMENT_REQUESTED',
        depositStatus: 'REQUESTED',
      }),
    ).toEqual({
      requestAccepted: false,
      shouldTransitionOrder: false,
    });
  });

  it('accepts pending payment requests and marks them for order status transition', () => {
    expect(
      getDepositRequestDecision({
        orderStatus: 'PENDING_PAYMENT',
        depositStatus: 'WAITING',
      }),
    ).toEqual({
      requestAccepted: true,
      shouldTransitionOrder: true,
    });
  });

  it('accepts repeated request processing on PAYMENT_REQUESTED when deposit is still waiting', () => {
    expect(
      getDepositRequestDecision({
        orderStatus: 'PAYMENT_REQUESTED',
        depositStatus: 'WAITING',
      }),
    ).toEqual({
      requestAccepted: true,
      shouldTransitionOrder: false,
    });
  });

  it('rejects deposit requests for non-payable order states', () => {
    expect(() =>
      getDepositRequestDecision({
        orderStatus: 'SHIPPED',
        depositStatus: 'WAITING',
      }),
    ).toThrow(ConflictException);
  });

  it('builds the default deposit request reason without memo', () => {
    expect(buildDepositRequestReason()).toBe('입금 요청 접수');
  });

  it('appends memo to the deposit request reason', () => {
    expect(buildDepositRequestReason('홍길동 이름으로 입금')).toBe(
      '입금 요청 접수: 홍길동 이름으로 입금',
    );
  });
});
