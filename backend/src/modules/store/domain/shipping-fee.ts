import { ShippingRegion } from '@prisma/client';

export const JEJU_SIDO = '제주특별자치도';

export type ShippingFeeSettings = {
  baseShippingFee: number;
  jejuAdditionalFee: number;
  islandAdditionalFee: number;
  freeShippingEnabled: boolean;
  freeShippingThreshold: number;
};

export type ShippingPricing = {
  region: ShippingRegion;
  baseShippingFee: number;
  additionalShippingFee: number;
  shippingFee: number;
};

/**
 * 배송 지역 구분값을 결정한다.
 * 제주도는 카카오 우편번호의 sido를 우선하고, 제주가 아닌 경우에만
 * 주문자가 직접 선택한 도서산간 여부를 사용한다.
 */
export function resolveShippingRegion(
  sido: string | undefined,
  isRemoteArea: boolean,
): ShippingRegion {
  if (sido?.trim() === JEJU_SIDO) {
    return ShippingRegion.JEJU;
  }

  return isRemoteArea ? ShippingRegion.ISLAND : ShippingRegion.NORMAL;
}

/**
 * 상품 금액과 배송 설정으로 주문 생성 시 사용할 배송비를 계산한다.
 * 무료배송은 기본 배송비에만 적용되고 지역 추가금은 유지된다.
 */
export function calculateShippingPricing(
  totalProductPrice: number,
  settings: ShippingFeeSettings,
  region: ShippingRegion,
): ShippingPricing {
  const baseShippingFee =
    settings.freeShippingEnabled && totalProductPrice >= settings.freeShippingThreshold
      ? 0
      : settings.baseShippingFee;

  const additionalShippingFee =
    region === ShippingRegion.JEJU
      ? settings.jejuAdditionalFee
      : region === ShippingRegion.ISLAND
        ? settings.islandAdditionalFee
        : 0;

  return {
    region,
    baseShippingFee,
    additionalShippingFee,
    shippingFee: baseShippingFee + additionalShippingFee,
  };
}
