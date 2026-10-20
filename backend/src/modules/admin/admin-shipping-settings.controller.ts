import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';

import { AdminSessionGuard } from '../auth/guards/admin-session.guard';
import { AdminService } from './admin.service';
import { UpdateAdminShippingSettingsDto } from './dto/update-admin-shipping-settings.dto';

@UseGuards(AdminSessionGuard)
@Controller('admin/shipping-settings')
export class AdminShippingSettingsController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  async getShippingSettings() {
    const data = await this.adminService.getShippingSettings();

    return {
      success: true,
      data,
    };
  }

  @Put()
  async updateShippingSettings(@Body() body: UpdateAdminShippingSettingsDto) {
    const data = await this.adminService.updateShippingSettings(body);

    return {
      success: true,
      data,
    };
  }
}
