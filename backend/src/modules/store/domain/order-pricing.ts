import { BadRequestException } from '@nestjs/common';

export type OrderPricingSnapshot = {
  totalProductPrice: number;
  shippingFee: number;
  finalTotalPrice: number;
};

export type PricedOrderItem = {
  lineTotalPrice: number;
};

const DISCOUNTED_PRICE_UNIT = 10;

export function calculateDiscountedPrice(basePrice: number, discountRate: number): number {
  const normalizedRate = Math.max(0, Math.min(100, discountRate));
  if (normalizedRate <= 0) {
    return Math.max(0, basePrice);
  }

  const discountedPrice = (basePrice * (100 - normalizedRate)) / 100;
  return Math.max(0, Math.floor(discountedPrice / DISCOUNTED_PRICE_UNIT) * DISCOUNTED_PRICE_UNIT);
}

export function buildOrderPricingFromItems(
  items: PricedOrderItem[],
  shippingFee: number,
): OrderPricingSnapshot {
  const totalProductPrice = items.reduce((sum, item) => sum + item.lineTotalPrice, 0);

  return {
    totalProductPrice,
    shippingFee,
    finalTotalPrice: totalProductPrice + shippingFee,
  };
}

export function buildCustomOrderPricing(
  finalTotalPrice: number,
  shippingFee: number,
): OrderPricingSnapshot {
  const totalProductPrice = finalTotalPrice - shippingFee;

  if (totalProductPrice < 0) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: '최종 결제 금액은 배송비보다 작을 수 없습니다.',
    });
  }

  return {
    totalProductPrice,
    shippingFee,
    finalTotalPrice,
  };
}
