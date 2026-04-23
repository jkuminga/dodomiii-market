export function calculateDiscountedPrice(basePrice: number, discountRate: number): number {
  const normalizedRate = Math.max(0, Math.min(100, discountRate));
  return Math.max(0, Math.floor((basePrice * (100 - normalizedRate)) / 100));
}

export function calculateDiscountAmount(basePrice: number, discountRate: number): number {
  return Math.max(0, basePrice - calculateDiscountedPrice(basePrice, discountRate));
}

export function formatDiscountRate(discountRate: number): string {
  const normalizedRate = Math.max(0, Math.min(100, discountRate));
  return `${normalizedRate}%`;
}
