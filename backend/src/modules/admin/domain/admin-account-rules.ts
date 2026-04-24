import { BadRequestException } from '@nestjs/common';

export type PrimaryDepositAccountInput = {
  isPrimaryDepositAccount: boolean;
  depositBankName: string | null;
  depositAccountHolder: string | null;
  depositAccountNumber: string | null;
};

export function normalizeOptional(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function assertPrimaryDepositAccountInput(input: PrimaryDepositAccountInput): void {
  if (!input.isPrimaryDepositAccount) {
    return;
  }

  if (!input.depositBankName || !input.depositAccountHolder || !input.depositAccountNumber) {
    throw new BadRequestException({
      code: 'PRIMARY_DEPOSIT_ACCOUNT_INCOMPLETE',
      message: '대표 입금계좌로 지정하려면 은행명, 예금주, 계좌번호를 모두 입력해야 합니다.',
    });
  }
}
