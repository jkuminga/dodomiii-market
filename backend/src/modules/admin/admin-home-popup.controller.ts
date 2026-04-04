import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';

import { AdminSessionGuard } from '../auth/guards/admin-session.guard';
import { UpdateAdminHomePopupDto } from './dto/update-admin-home-popup.dto';
import { AdminService } from './admin.service';

@UseGuards(AdminSessionGuard)
@Controller('admin/home-popup')
export class AdminHomePopupController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  async getHomePopup() {
    const data = await this.adminService.getLatestHomePopup();

    return {
      success: true,
      data,
    };
  }

  @Put()
  async upsertHomePopup(@Body() body: UpdateAdminHomePopupDto) {
    const data = await this.adminService.upsertHomePopup(body);

    return {
      success: true,
      data,
    };
  }
}
