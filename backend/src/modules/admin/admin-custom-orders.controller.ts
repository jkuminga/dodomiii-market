import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';

import { AdminRequest } from '../auth/admin-session.types';
import { AdminSessionGuard } from '../auth/guards/admin-session.guard';
import { StoreService } from '../store/store.service';
import { AdminCustomOrderLinksQueryDto } from './dto/admin-custom-order-links-query.dto';
import { AdminCustomOrderLinkIdParamDto } from './dto/admin-custom-order-link-id-param.dto';
import { CreateAdminCustomOrderLinkDto } from './dto/create-admin-custom-order-link.dto';

@UseGuards(AdminSessionGuard)
@Controller('admin/custom-orders')
export class AdminCustomOrdersController {
  constructor(private readonly storeService: StoreService) {}

  @Post('links')
  async createLink(@Body() body: CreateAdminCustomOrderLinkDto, @Req() request: AdminRequest) {
    const data = await this.storeService.createCustomOrderLink(
      Number(request.session.admin!.adminId),
      body,
    );

    return {
      success: true,
      data,
    };
  }

  @Get('links')
  async getLinks(@Query() query: AdminCustomOrderLinksQueryDto) {
    const data = await this.storeService.getAdminCustomOrderLinks(query.limit ?? 10);

    return {
      success: true,
      data: {
        items: data,
      },
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
