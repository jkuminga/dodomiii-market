import { Module } from '@nestjs/common';

import { AdminCategoriesController } from './admin-categories.controller';
import { AdminOrderNotificationsService } from './admin-order-notifications.service';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminOrdersService } from './admin-orders.service';
import { AdminProductsController } from './admin-products.controller';
import { AdminService } from './admin.service';

@Module({
  controllers: [AdminCategoriesController, AdminProductsController, AdminOrdersController],
  providers: [AdminService, AdminOrdersService, AdminOrderNotificationsService],
})
export class AdminModule {}
