import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';

import { AdminSessionGuard } from '../auth/guards/admin-session.guard';
import { HomeItemIdParamDto } from './dto/home-item-id-param.dto';
import { UpdateAdminHomeItemDto } from './dto/update-admin-home-item.dto';
import { AdminService } from './admin.service';

@UseGuards(AdminSessionGuard)
@Controller('admin/home-items')
export class AdminHomeItemsController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  async getHomeItems() {
    const data = await this.adminService.getHomeItems();

    return {
      success: true,
      data,
    };
  }

  @Get(':itemId')
  async getHomeItemById(@Param() params: HomeItemIdParamDto) {
    const data = await this.adminService.getHomeItemById(params.itemId);

    return {
      success: true,
      data,
    };
  }

  @Put()
  async upsertHomeItem(@Body() body: UpdateAdminHomeItemDto) {
    const data = await this.adminService.upsertHomeItem(body);

    return {
      success: true,
      data,
    };
  }
}
