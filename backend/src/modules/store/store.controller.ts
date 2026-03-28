import { Controller, Get, Param, Query } from '@nestjs/common';

import { GetProductsQueryDto } from './dto/get-products.query.dto';
import { StoreService } from './store.service';

@Controller('store')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Get('categories')
  async getCategories() {
    const data = await this.storeService.getVisibleCategories();

    return {
      success: true,
      data,
    };
  }

  @Get('products')
  async getProducts(@Query() query: GetProductsQueryDto) {
    const result = await this.storeService.getVisibleProducts(query);

    return {
      success: true,
      data: {
        items: result.items,
      },
      meta: result.meta,
    };
  }

  @Get('products/:productId')
  async getProduct(@Param('productId') productId: string) {
    const data = await this.storeService.getVisibleProductById(productId);

    return {
      success: true,
      data,
    };
  }
}
