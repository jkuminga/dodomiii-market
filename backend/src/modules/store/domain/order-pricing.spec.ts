import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';

import {
  buildCustomOrderPricing,
  buildOrderPricingFromItems,
  calculateDiscountedPrice,
} from './order-pricing';

describe('order pricing', () => {
  it('calculates discounted prices with rate bounds and ten-won floor rounding', () => {
    expect(calculateDiscountedPrice(10000, 0)).toBe(10000);
    expect(calculateDiscountedPrice(10000, 15)).toBe(8500);
    expect(calculateDiscountedPrice(9999, 15)).toBe(8490);
    expect(calculateDiscountedPrice(7500, 5)).toBe(7120);
    expect(calculateDiscountedPrice(7505, 0)).toBe(7505);
    expect(calculateDiscountedPrice(10000, -10)).toBe(10000);
    expect(calculateDiscountedPrice(10000, 120)).toBe(0);
  });

  it('builds an order pricing snapshot from item totals and shipping fee', () => {
    const result = buildOrderPricingFromItems(
      [{ lineTotalPrice: 12000 }, { lineTotalPrice: 8000 }],
      3000,
    );

    expect(result).toEqual({
      totalProductPrice: 20000,
      shippingFee: 3000,
      finalTotalPrice: 23000,
    });
  });

  it('builds custom order pricing from final total and shipping fee', () => {
    expect(buildCustomOrderPricing(62000, 3000)).toEqual({
      totalProductPrice: 59000,
      shippingFee: 3000,
      finalTotalPrice: 62000,
    });
  });

  it('rejects custom order totals smaller than shipping fee', () => {
    expect(() => buildCustomOrderPricing(2000, 3000)).toThrow(BadRequestException);
  });
});
