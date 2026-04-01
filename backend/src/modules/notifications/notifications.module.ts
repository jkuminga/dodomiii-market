import { Module } from '@nestjs/common';

import { EmailNotificationService } from './email-notification.service';
import { OrderNotificationsService } from './order-notifications.service';
import { SmsNotificationService } from './sms-notification.service';

@Module({
  providers: [EmailNotificationService, SmsNotificationService, OrderNotificationsService],
  exports: [EmailNotificationService, SmsNotificationService, OrderNotificationsService],
})
export class NotificationsModule {}
