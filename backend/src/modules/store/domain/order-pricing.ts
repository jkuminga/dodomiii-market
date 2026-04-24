import { BadRequestException } from '@nestjs/common';

export type OrderPricingSnapshot = {
  totalProductPrice: number;
  shippingFee: number;
  finalTotalPrice: number;
};

export type PricedOrderItem = {
  lineTotalPrice: number;
};

export function calculateDiscountedPrice(basePrice: number, discountRate: number): number {
  const normalizedRate = Math.max(0, Math.min(100, discountRate));
  return Math.max(0, Math.floor((basePrice * (100 - normalizedRate)) / 100));
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
