import { ConflictException } from '@nestjs/common';
import { DepositStatus, type OrderStatus } from '@prisma/client';

const DEPOSIT_REQUEST_REASON = '입금 요청 접수';

export type DepositRequestDecisionInput = {
  orderStatus: OrderStatus;
  depositStatus: DepositStatus;
};

export type DepositRequestDecision =
  | {
      requestAccepted: false;
      shouldTransitionOrder: false;
    }
  | {
      requestAccepted: true;
      shouldTransitionOrder: boolean;
    };

export function getDepositRequestDecision(
  input: DepositRequestDecisionInput,
): DepositRequestDecision {
  if (
    input.depositStatus === DepositStatus.CONFIRMED ||
    (input.depositStatus === DepositStatus.REQUESTED &&
      input.orderStatus === 'PAYMENT_REQUESTED')
  ) {
    return {
      requestAccepted: false,
      shouldTransitionOrder: false,
    };
  }

  if (input.orderStatus !== 'PENDING_PAYMENT' && input.orderStatus !== 'PAYMENT_REQUESTED') {
    throw new ConflictException({
      code: 'INVALID_STATUS_TRANSITION',
      message: '입금 요청을 처리할 수 없는 주문 상태입니다.',
    });
  }

  return {
    requestAccepted: true,
    shouldTransitionOrder: input.orderStatus === 'PENDING_PAYMENT',
  };
}

export function buildDepositRequestReason(memo?: string): string {
  if (!memo) {
    return DEPOSIT_REQUEST_REASON;
  }

  return `${DEPOSIT_REQUEST_REASON}: ${memo}`;
}
