import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { StoreCacheService } from './store-cache.service';
import { StoreController } from './store.controller';
import { StoreService } from './store.service';

@Module({
  imports: [NotificationsModule],
  controllers: [StoreController],
  providers: [StoreService, StoreCacheService],
  exports: [StoreService, StoreCacheService],
})
export class StoreModule {}
