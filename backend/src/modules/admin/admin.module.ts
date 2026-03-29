import { Module } from '@nestjs/common';

import { AdminCategoriesController } from './admin-categories.controller';
import { AdminProductsController } from './admin-products.controller';
import { AdminService } from './admin.service';

@Module({
  controllers: [AdminCategoriesController, AdminProductsController],
  providers: [AdminService],
})
export class AdminModule {}
