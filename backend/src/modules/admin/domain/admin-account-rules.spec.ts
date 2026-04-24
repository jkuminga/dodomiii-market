import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';

import { assertPrimaryDepositAccountInput, normalizeOptional } from './admin-account-rules';

describe('admin account rules', () => {
  it('normalizes optional strings while preserving undefined for partial updates', () => {
    expect(normalizeOptional(undefined)).toBeUndefined();
    expect(normalizeOptional(null)).toBeNull();
    expect(normalizeOptional('  admin@example.test  ')).toBe('admin@example.test');
    expect(normalizeOptional('   ')).toBeNull();
  });

  it('allows non-primary deposit accounts without deposit fields', () => {
    expect(() =>
      assertPrimaryDepositAccountInput({
        isPrimaryDepositAccount: false,
        depositBankName: null,
        depositAccountHolder: null,
        depositAccountNumber: null,
      }),
    ).not.toThrow();
  });

  it('requires every deposit field for primary deposit accounts', () => {
    expect(() =>
      assertPrimaryDepositAccountInput({
        isPrimaryDepositAccount: true,
        depositBankName: '국민은행',
        depositAccountHolder: '도도미마켓',
        depositAccountNumber: null,
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      assertPrimaryDepositAccountInput({
        isPrimaryDepositAccount: true,
        depositBankName: '국민은행',
        depositAccountHolder: '도도미마켓',
        depositAccountNumber: '000-00-000000',
      }),
    ).not.toThrow();
  });
});
