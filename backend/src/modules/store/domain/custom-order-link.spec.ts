import { BadRequestException, ConflictException } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';

import {
  assertCustomOrderLinkAvailable,
  buildCustomCheckoutUrl,
  getCustomOrderLinkAvailability,
  parseCustomOrderLinkExpiresAt,
} from './custom-order-link';

const now = new Date('2026-04-24T00:00:00.000Z');

describe('custom order link helpers', () => {
  it('parses future expiration timestamps', () => {
    expect(parseCustomOrderLinkExpiresAt('2026-04-25T00:00:00.000Z', now).toISOString()).toBe(
      '2026-04-25T00:00:00.000Z',
    );
  });

  it('rejects invalid or past expiration timestamps', () => {
    expect(() => parseCustomOrderLinkExpiresAt('not-a-date', now)).toThrow(BadRequestException);
    expect(() => parseCustomOrderLinkExpiresAt('2026-04-23T00:00:00.000Z', now)).toThrow(
      BadRequestException,
    );
  });

  it('builds checkout urls with encoded tokens and normalized base url', () => {
    expect(buildCustomCheckoutUrl('https://shop.example.test/custom-checkout///', 'cus_a/b')).toBe(
      'https://shop.example.test/custom-checkout/cus_a%2Fb',
    );
  });

  it('reports availability from active, expiration, deletion, and usage state', () => {
    expect(
      getCustomOrderLinkAvailability(
        {
          isActive: true,
          expiresAt: new Date('2026-04-25T00:00:00.000Z'),
          usedAt: null,
          usedOrderId: null,
          deletedAt: null,
        },
        now,
      ),
    ).toEqual({
      isExpired: false,
      isUsed: false,
      isAvailable: true,
    });

    expect(
      getCustomOrderLinkAvailability(
        {
          isActive: true,
          expiresAt: new Date('2026-04-25T00:00:00.000Z'),
          usedAt: null,
          usedOrderId: 1,
          deletedAt: null,
        },
        now,
      ).isAvailable,
    ).toBe(false);
  });

  it('throws when a custom order link cannot be used', () => {
    expect(() =>
      assertCustomOrderLinkAvailable(
        {
          isActive: false,
          expiresAt: new Date('2026-04-25T00:00:00.000Z'),
          usedAt: null,
          usedOrderId: null,
        },
        now,
      ),
    ).toThrow(ConflictException);
  });
});
