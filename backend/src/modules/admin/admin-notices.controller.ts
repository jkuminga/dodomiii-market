import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { AdminSessionGuard } from '../auth/guards/admin-session.guard';
import { AdminService } from './admin.service';
import { AdminNoticeIdParamDto } from './dto/admin-notice-id-param.dto';
import { CreateAdminNoticeDto } from './dto/create-admin-notice.dto';
import { GetAdminNoticesQueryDto } from './dto/get-admin-notices.query.dto';
import { UpdateAdminNoticeDto } from './dto/update-admin-notice.dto';

@UseGuards(AdminSessionGuard)
@Controller('admin/notices')
export class AdminNoticesController {
  constructor(private readonly adminService: AdminService) {}

  @Post()
  async createNotice(@Body() body: CreateAdminNoticeDto) {
    const data = await this.adminService.createNotice(body);

    return {
      success: true,
      data,
    };
  }

  @Get()
  async getNotices(@Query() query: GetAdminNoticesQueryDto) {
    const result = await this.adminService.getNotices(query);

    return {
      success: true,
      data: {
        items: result.items,
      },
      meta: result.meta,
    };
  }

  @Get(':noticeId')
  async getNotice(@Param() params: AdminNoticeIdParamDto) {
    const data = await this.adminService.getNotice(params.noticeId);

    return {
      success: true,
      data,
    };
  }

  @Patch(':noticeId')
  async updateNotice(@Param() params: AdminNoticeIdParamDto, @Body() body: UpdateAdminNoticeDto) {
    const data = await this.adminService.updateNotice(params.noticeId, body);

    return {
      success: true,
      data,
    };
  }

  @Delete(':noticeId')
  async deleteNotice(@Param() params: AdminNoticeIdParamDto) {
    const data = await this.adminService.deleteNotice(params.noticeId);

    return {
      success: true,
      data,
    };
  }
}
