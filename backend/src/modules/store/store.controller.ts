import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { CreateDepositRequestDto } from './dto/create-deposit-request.dto';
import { CreateCustomCheckoutOrderDto } from './dto/create-custom-checkout-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { CustomCheckoutTokenParamDto } from './dto/custom-checkout-token-param.dto';
import { GetProductsQueryDto } from './dto/get-products.query.dto';
import { NoticeIdParamDto } from './dto/notice-id-param.dto';
import { OrderAccessQueryDto } from './dto/order-access.query.dto';
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

  @Get('home-popup')
  async getHomePopup() {
    const data = await this.storeService.getActiveHomePopup();

    return {
      success: true,
      data,
    };
  }

  @Get('home-hero')
  async getHomeHero() {
    const data = await this.storeService.getHomeHero();

    return {
      success: true,
      data,
    };
  }

  @Get('settings')
  async getStorefrontSettings() {
    const data = await this.storeService.getStorefrontSettings();

    return {
      success: true,
      data,
    };
  }

  @Get('notices')
  async getNotices() {
    const data = await this.storeService.getVisibleNotices();

    return {
      success: true,
      data,
    };
  }

  @Get('notices/:noticeId')
  async getNotice(@Param() params: NoticeIdParamDto) {
    const data = await this.storeService.getVisibleNoticeById(params.noticeId);

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

  @Get('custom-checkout/:token')
  async getCustomCheckout(@Param() params: CustomCheckoutTokenParamDto) {
    const data = await this.storeService.getCustomCheckout(params.token);

    return {
      success: true,
      data,
    };
  }

  @Post('custom-checkout/:token/orders')
  async createCustomCheckoutOrder(
    @Param() params: CustomCheckoutTokenParamDto,
    @Body() body: CreateCustomCheckoutOrderDto,
  ) {
    const data = await this.storeService.createCustomCheckoutOrder(params.token, body);

    return {
      success: true,
      data,
    };
  }

  @Get('orders/:orderNumber')
  async getOrder(@Param() params: OrderNumberParamDto, @Query() query: OrderAccessQueryDto) {
    const data = await this.storeService.getOrderByOrderNumber(
      params.orderNumber,
      query.contactPhone,
    );

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
  async getOrderTracking(@Param() params: OrderNumberParamDto, @Query() query: OrderAccessQueryDto) {
    const data = await this.storeService.getOrderTracking(params.orderNumber, query.contactPhone);

    return {
      success: true,
      data,
    };
  }
}
