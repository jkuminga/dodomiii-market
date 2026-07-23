const DISCOUNTED_PRICE_UNIT = 10;

export function calculateDiscountedPrice(basePrice: number, discountRate: number): number {
  const normalizedRate = Math.max(0, Math.min(100, discountRate));
  if (normalizedRate <= 0) {
    return Math.max(0, basePrice);
  }

  const discountedPrice = (basePrice * (100 - normalizedRate)) / 100;
  return Math.max(0, Math.floor(discountedPrice / DISCOUNTED_PRICE_UNIT) * DISCOUNTED_PRICE_UNIT);
}

export function calculateDiscountAmount(basePrice: number, discountRate: number): number {
  return Math.max(0, basePrice - calculateDiscountedPrice(basePrice, discountRate));
}

export function formatDiscountRate(discountRate: number): string {
  const normalizedRate = Math.max(0, Math.min(100, discountRate));
  return `${normalizedRate}% OFF`;
}
