import { BadRequestException } from '@nestjs/common';

export type OrderContactAddressInput = {
  address1: string;
  address2?: string;
  userSelectedType?: 'R' | 'J';
  roadAddress?: string;
  jibunAddress?: string;
};

export type NormalizedOrderContactAddress = {
  address1: string;
  address2: string | null;
};

export function normalizeOrderContactAddress(
  contact: OrderContactAddressInput,
): NormalizedOrderContactAddress {
  const trimmedAddress1 = contact.address1.trim();
  const selectedType =
    contact.userSelectedType ?? (trimmedAddress1 === 'R' || trimmedAddress1 === 'J' ? trimmedAddress1 : undefined);

  const resolvedAddress1 = selectedType
    ? resolveAddressBySelectedType(selectedType, contact.roadAddress, contact.jibunAddress)
    : trimmedAddress1;

  if (!resolvedAddress1) {
    throw createInvalidAddressException('기본 배송지 주소를 입력해주세요.');
  }

  const trimmedAddress2 = contact.address2?.trim();

  return {
    address1: resolvedAddress1,
    address2: trimmedAddress2 ? trimmedAddress2 : null,
  };
}

function resolveAddressBySelectedType(
  userSelectedType: 'R' | 'J',
  roadAddress?: string,
  jibunAddress?: string,
): string {
  const selectedAddress =
    userSelectedType === 'R' ? roadAddress?.trim() ?? '' : jibunAddress?.trim() ?? '';

  if (!selectedAddress) {
    throw createInvalidAddressException(
      userSelectedType === 'R'
        ? '도로명 주소를 선택한 경우 roadAddress 값이 필요합니다.'
        : '지번 주소를 선택한 경우 jibunAddress 값이 필요합니다.',
    );
  }

  return selectedAddress;
}

function createInvalidAddressException(message: string): BadRequestException {
  return new BadRequestException({
    code: 'VALIDATION_ERROR',
    message,
  });
}
