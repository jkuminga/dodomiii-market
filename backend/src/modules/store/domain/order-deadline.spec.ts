import { describe, expect, it } from '@jest/globals';

import { formatOrderDate, getDepositDeadlineAt, toIsoString, toKstDate } from './order-deadline';

describe('order deadline helpers', () => {
  it('formats order dates by KST calendar day', () => {
    expect(formatOrderDate(new Date('2026-04-23T15:10:00.000Z'))).toBe('20260424');
  });

  it('builds deposit deadline at 23:59:59 KST after the configured days', () => {
    const deadline = getDepositDeadlineAt(new Date('2026-04-24T01:30:00.000Z'), 1);

    expect(deadline.toISOString()).toBe('2026-04-25T14:59:59.000Z');
  });

  it('converts a date to KST offset and normalizes nullable ISO strings', () => {
    expect(toKstDate(new Date('2026-04-24T01:30:00.000Z')).toISOString()).toBe(
      '2026-04-24T10:30:00.000Z',
    );
    expect(toIsoString(new Date('2026-04-24T01:30:00.000Z'))).toBe(
      '2026-04-24T01:30:00.000Z',
    );
    expect(toIsoString(null)).toBeNull();
  });
});
