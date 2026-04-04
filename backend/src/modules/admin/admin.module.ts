import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { StoreModule } from '../store/store.module';
import { AdminCategoriesController } from './admin-categories.controller';
import { AdminMediaController } from './admin-media.controller';
import { AdminMediaService } from './admin-media.service';
import { AdminInstagramController } from './admin-instagram.controller';
import { AdminInstagramService } from './admin-instagram.service';
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
    AdminProductsController,
    AdminOrdersController,
    AdminCustomOrdersController,
    AdminHomePopupController,
    AdminMediaController,
    AdminInstagramController,
  ],
  providers: [
    AdminService,
    AdminOrdersService,
    AdminOrderNotificationsService,
    AdminInstagramService,
    AdminMediaService,
  ],
})
export class AdminModule {}
