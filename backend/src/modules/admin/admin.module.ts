import { Module } from '@nestjs/common';

import { AdminCategoriesController } from './admin-categories.controller';
import { AdminCustomOrdersController } from './admin-custom-orders.controller';
import { AdminOrderNotificationsService } from './admin-order-notifications.service';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminOrdersService } from './admin-orders.service';
import { AdminProductsController } from './admin-products.controller';
import { AdminService } from './admin.service';
import { StoreModule } from '../store/store.module';

@Module({
  imports: [StoreModule],
  controllers: [
    AdminCategoriesController,
    AdminProductsController,
    AdminOrdersController,
    AdminCustomOrdersController,
  ],
  providers: [AdminService, AdminOrdersService, AdminOrderNotificationsService],
})
export class AdminModule {}
