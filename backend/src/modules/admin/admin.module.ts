import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { StoreModule } from '../store/store.module';
import { AdminAccountsController } from './admin-accounts.controller';
import { AdminAccountsService } from './admin-accounts.service';
import { AdminCategoriesController } from './admin-categories.controller';
import { AdminMediaController } from './admin-media.controller';
import { AdminNoticesController } from './admin-notices.controller';
import { AdminMediaService } from './admin-media.service';
import { AdminHomePopupController } from './admin-home-popup.controller';
import { AdminCustomOrdersController } from './admin-custom-orders.controller';
import { AdminOrderNotificationsService } from './admin-order-notifications.service';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminOrdersService } from './admin-orders.service';
import { AdminProductsController } from './admin-products.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [StoreModule, NotificationsModule],
  controllers: [
    AdminCategoriesController,
    AdminAccountsController,
    AdminProductsController,
    AdminOrdersController,
    AdminCustomOrdersController,
    AdminHomePopupController,
    AdminMediaController,
    AdminNoticesController,
  ],
  providers: [
    AdminService,
    AdminAccountsService,
    AdminOrdersService,
    AdminOrderNotificationsService,
    AdminMediaService,
  ],
})
export class AdminModule {}
