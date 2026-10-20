import { ShippingRegion } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';

import { calculateShippingPricing, resolveShippingRegion } from './shipping-fee';

const settings = {
  baseShippingFee: 3000,
  jejuAdditionalFee: 3000,
  islandAdditionalFee: 5000,
  freeShippingEnabled: true,
  freeShippingThreshold: 10000,
};

describe('shipping fee policy', () => {
  it('uses the base fee below the free-shipping threshold', () => {
    expect(calculateShippingPricing(9990, settings, ShippingRegion.NORMAL)).toEqual({
      region: ShippingRegion.NORMAL,
      baseShippingFee: 3000,
      additionalShippingFee: 0,
      shippingFee: 3000,
    });
  });

  it('removes only the base fee at the free-shipping threshold', () => {
    expect(calculateShippingPricing(10000, settings, ShippingRegion.NORMAL)).toEqual({
      region: ShippingRegion.NORMAL,
      baseShippingFee: 0,
      additionalShippingFee: 0,
      shippingFee: 0,
    });
  });

  it('keeps the base fee when the free-shipping policy is disabled', () => {
    expect(
      calculateShippingPricing(
        10000,
        { ...settings, freeShippingEnabled: false },
        ShippingRegion.NORMAL,
      ).shippingFee,
    ).toBe(3000);
  });

  it('keeps Jeju and island additional fees after free shipping', () => {
    expect(calculateShippingPricing(10000, settings, ShippingRegion.JEJU).shippingFee).toBe(3000);
    expect(calculateShippingPricing(10000, settings, ShippingRegion.ISLAND).shippingFee).toBe(5000);
  });

  it('prioritizes Jeju over the manual island-area checkbox', () => {
    expect(resolveShippingRegion(' 제주특별자치도 ', true)).toBe(ShippingRegion.JEJU);
    expect(resolveShippingRegion('서울특별시', true)).toBe(ShippingRegion.ISLAND);
    expect(resolveShippingRegion('서울특별시', false)).toBe(ShippingRegion.NORMAL);
  });
});
