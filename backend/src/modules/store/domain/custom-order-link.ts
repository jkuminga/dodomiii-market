import { BadRequestException, ConflictException } from '@nestjs/common';

export type CustomOrderLinkAvailabilityInput = {
  isActive: boolean;
  expiresAt: Date;
  usedAt: Date | null;
  usedOrderId: bigint | number | null;
};

export function parseCustomOrderLinkExpiresAt(value: string, now = new Date()): Date {
  const expiresAt = new Date(value);

  if (Number.isNaN(expiresAt.getTime())) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: '만료 시각 형식이 올바르지 않습니다.',
    });
  }

  if (expiresAt.getTime() <= now.getTime()) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: '만료 시각은 현재 시각 이후여야 합니다.',
    });
  }

  return expiresAt;
}

export function buildCustomCheckoutUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${encodeURIComponent(token)}`;
}

export function getCustomOrderLinkAvailability(
  link: CustomOrderLinkAvailabilityInput & { deletedAt?: Date | null },
  now = new Date(),
): {
  isExpired: boolean;
  isUsed: boolean;
  isAvailable: boolean;
} {
  const isExpired = link.expiresAt.getTime() <= now.getTime();
  const isUsed = Boolean(link.usedOrderId);

  return {
    isExpired,
    isUsed,
    isAvailable: link.isActive && !isExpired && !link.deletedAt && !isUsed,
  };
}

export function assertCustomOrderLinkAvailable(
  link: CustomOrderLinkAvailabilityInput,
  now: Date,
): void {
  if (!link.isActive) {
    throw new ConflictException({
      code: 'CUSTOM_ORDER_LINK_INACTIVE',
      message: '비활성화된 커스텀 주문 링크입니다.',
    });
  }

  if (link.expiresAt.getTime() <= now.getTime()) {
    throw new ConflictException({
      code: 'CUSTOM_ORDER_LINK_EXPIRED',
      message: '만료된 커스텀 주문 링크입니다.',
    });
  }

  if (link.usedAt || link.usedOrderId) {
    throw new ConflictException({
      code: 'CUSTOM_ORDER_LINK_ALREADY_USED',
      message: '이미 사용된 커스텀 주문 링크입니다.',
    });
  }
}
