import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { CreateDepositRequestDto } from './dto/create-deposit-request.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { GetProductsQueryDto } from './dto/get-products.query.dto';
import { OrderNumberParamDto } from './dto/order-number-param.dto';
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

  @Post('orders')
  async createOrder(@Body() body: CreateOrderDto) {
    const data = await this.storeService.createOrder(body);

    return {
      success: true,
      data,
    };
  }

  @Get('orders/:orderNumber')
  async getOrder(@Param() params: OrderNumberParamDto) {
    const data = await this.storeService.getOrderByOrderNumber(params.orderNumber);

    return {
      success: true,
      data,
    };
  }

  @Post('orders/:orderNumber/deposit-requests')
  async createDepositRequest(
    @Param() params: OrderNumberParamDto,
    @Body() body: CreateDepositRequestDto,
  ) {
    const data = await this.storeService.createDepositRequest(params.orderNumber, body);

    return {
      success: true,
      data,
    };
  }

  @Get('orders/:orderNumber/tracking')
  async getOrderTracking(@Param() params: OrderNumberParamDto) {
    const data = await this.storeService.getOrderTracking(params.orderNumber);

    return {
      success: true,
      data,
    };
  }
}
