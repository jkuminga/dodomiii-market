import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';

import { AdminSessionGuard } from '../auth/guards/admin-session.guard';
import { StoreService } from '../store/store.service';
import { AdminCustomOrderLinkIdParamDto } from './dto/admin-custom-order-link-id-param.dto';
import { CreateAdminCustomOrderLinkDto } from './dto/create-admin-custom-order-link.dto';

@UseGuards(AdminSessionGuard)
@Controller('admin/custom-orders')
export class AdminCustomOrdersController {
  constructor(private readonly storeService: StoreService) {}

  @Post('links')
  async createLink(@Body() body: CreateAdminCustomOrderLinkDto, @Req() request: Request) {
    const data = await this.storeService.createCustomOrderLink(
      Number(request.session.admin!.adminId),
      body,
    );

    return {
      success: true,
      data,
    };
  }

  @Get('links/:linkId')
  async getLink(@Param() params: AdminCustomOrderLinkIdParamDto) {
    const data = await this.storeService.getAdminCustomOrderLink(params.linkId);

    return {
      success: true,
      data,
    };
  }
}
