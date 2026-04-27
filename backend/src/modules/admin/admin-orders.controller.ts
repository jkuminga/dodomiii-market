import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AdminRequest } from '../auth/admin-session.types';
import { AdminSessionGuard } from '../auth/guards/admin-session.guard';
import { AdminOrderIdParamDto } from './dto/admin-order-id-param.dto';
import { GetAdminOrdersQueryDto } from './dto/get-admin-orders.query.dto';
import { UpdateAdminOrderShipmentDto } from './dto/update-admin-order-shipment.dto';
import { UpdateAdminOrderStatusDto } from './dto/update-admin-order-status.dto';
import { AdminOrdersService } from './admin-orders.service';

@UseGuards(AdminSessionGuard)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly adminOrdersService: AdminOrdersService) {}

  @Get()
  async getOrders(@Query() query: GetAdminOrdersQueryDto) {
    const result = await this.adminOrdersService.getOrders(query);

    return {
      success: true,
      data: {
        items: result.items,
      },
      meta: result.meta,
    };
  }

  @Get(':orderId')
  async getOrder(@Param() params: AdminOrderIdParamDto) {
    const data = await this.adminOrdersService.getOrder(params.orderId);

    return {
      success: true,
      data,
    };
  }

  @Patch(':orderId/status')
  async updateOrderStatus(
    @Param() params: AdminOrderIdParamDto,
    @Body() body: UpdateAdminOrderStatusDto,
    @Req() request: AdminRequest,
  ) {
    const data = await this.adminOrdersService.updateOrderStatus(
      params.orderId,
      Number(request.session.admin!.adminId),
      body,
    );

    return {
      success: true,
      data,
    };
  }

  @Patch(':orderId/shipment')
  async updateOrderShipment(
    @Param() params: AdminOrderIdParamDto,
    @Body() body: UpdateAdminOrderShipmentDto,
    @Req() request: AdminRequest,
  ) {
    const data = await this.adminOrdersService.updateOrderShipment(
      params.orderId,
      Number(request.session.admin!.adminId),
      body,
    );

    return {
      success: true,
      data,
    };
  }
}
