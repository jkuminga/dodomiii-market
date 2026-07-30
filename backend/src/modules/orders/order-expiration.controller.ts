import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

import { OrderExpirationService } from './order-expiration.service';

// Vercel Cron 전용 엔드포인트다. CRON_SECRET과 일치하는 호출만 주문 만료를 실행한다.
@Controller('internal/cron')
export class OrderExpirationController {
  constructor(
    private readonly configService: ConfigService,
    private readonly orderExpirationService: OrderExpirationService,
  ) {}

  @Get('expire-orders')
  async expireOrders(@Headers('authorization') authorization: string | undefined) {
    this.assertCronAuthorized(authorization);

    return {
      success: true,
      data: await this.orderExpirationService.expireDueOrders(),
    };
  }

  private assertCronAuthorized(authorization: string | undefined): void {
    const cronSecret = this.configService.get<string>('CRON_SECRET')?.trim() ?? '';
    const expectedAuthorization = `Bearer ${cronSecret}`;

    if (
      !cronSecret ||
      !authorization ||
      authorization.length !== expectedAuthorization.length ||
      !timingSafeEqual(Buffer.from(authorization), Buffer.from(expectedAuthorization))
    ) {
      throw new UnauthorizedException({
        code: 'CRON_UNAUTHORIZED',
        message: '유효하지 않은 Cron 요청입니다.',
      });
    }
  }
}
