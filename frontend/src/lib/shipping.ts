import type { ShippingSettings } from './api';

/** 카카오 우편번호 API의 시/도 값으로 제주 주소를 식별할 때 사용하는 값입니다. */
export const JEJU_SIDO = '제주특별자치도';

/** 주문 배송비 계산에 사용하는 주소 지역 구분입니다. */
export type ShippingRegion = 'NORMAL' | 'JEJU' | 'ISLAND';

/** 결제 예상 금액에 표시할 할인 전·후 기본 배송비와 지역 추가금 내역입니다. */
export type ShippingFeeBreakdown = {
  region: ShippingRegion;
  originalBaseShippingFee: number;
  baseShippingFee: number;
  additionalShippingFee: number;
  baseShippingDiscounted: boolean;
  shippingFee: number;
};

/** 배송 설정 API가 일시적으로 응답하지 않아도 화면 계산을 유지하기 위한 초기 기본값입니다. */
export const DEFAULT_SHIPPING_SETTINGS: ShippingSettings = {
  baseShippingFee: 3000,
  jejuAdditionalFee: 3000,
  islandAdditionalFee: 5000,
  freeShippingEnabled: true,
  freeShippingThreshold: 10000,
  updatedAt: '',
};

/** 제주를 우선 판별하고, 제주가 아니면 사용자가 표시한 도서산간 여부를 적용합니다. */
export function resolveShippingRegion(sido: string | undefined, isRemoteArea: boolean): ShippingRegion {
  if (sido?.trim() === JEJU_SIDO) {
    return 'JEJU';
  }

  return isRemoteArea ? 'ISLAND' : 'NORMAL';
}

/** 무료배송은 기본 배송비에만 적용하고 제주·도서산간 추가금은 유지합니다. */
export function calculateShippingFeeBreakdown(
  totalProductPrice: number,
  settings: ShippingSettings | null | undefined,
  region: ShippingRegion,
): ShippingFeeBreakdown {
  const resolvedSettings = settings ?? DEFAULT_SHIPPING_SETTINGS;
  const baseShippingDiscounted =
    resolvedSettings.baseShippingFee > 0 &&
    resolvedSettings.freeShippingEnabled &&
    totalProductPrice >= resolvedSettings.freeShippingThreshold;
  const baseShippingFee = baseShippingDiscounted ? 0 : resolvedSettings.baseShippingFee;
  const additionalShippingFee =
    region === 'JEJU'
      ? resolvedSettings.jejuAdditionalFee
      : region === 'ISLAND'
        ? resolvedSettings.islandAdditionalFee
        : 0;

  return {
    region,
    originalBaseShippingFee: resolvedSettings.baseShippingFee,
    baseShippingFee,
    additionalShippingFee,
    baseShippingDiscounted,
    shippingFee: baseShippingFee + additionalShippingFee,
  };
}

/** 상품 금액과 배송 지역을 기준으로 최종 배송비를 계산합니다. */
export function calculateShippingFee(
  totalProductPrice: number,
  settings: ShippingSettings | null | undefined,
  region: ShippingRegion,
): number {
  return calculateShippingFeeBreakdown(totalProductPrice, settings, region).shippingFee;
}
