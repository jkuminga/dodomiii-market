import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { OrderExpirationController } from './order-expiration.controller';
import { OrderExpirationService } from './order-expiration.service';

@Module({
  imports: [NotificationsModule],
  controllers: [OrderExpirationController],
  providers: [OrderExpirationService],
})
export class OrderExpirationModule {}
