import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';

import { AdminSessionGuard } from '../auth/guards/admin-session.guard';
import { UpdateAdminHomeHeroDto } from './dto/update-admin-home-hero.dto';
import { UpdateAdminHomePopupDto } from './dto/update-admin-home-popup.dto';
import { UpdateAdminStorefrontSettingsDto } from './dto/update-admin-storefront-settings.dto';
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

  @Get('hero-image')
  async getHomeHero() {
    const data = await this.adminService.getHomeHero();

    return {
      success: true,
      data,
    };
  }

  @Get('storefront-settings')
  async getStorefrontSettings() {
    const data = await this.adminService.getStorefrontSettings();

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

  @Put('hero-image')
  async upsertHomeHero(@Body() body: UpdateAdminHomeHeroDto) {
    const data = await this.adminService.upsertHomeHero(body);

    return {
      success: true,
      data,
    };
  }

  @Put('storefront-settings')
  async updateStorefrontSettings(@Body() body: UpdateAdminStorefrontSettingsDto) {
    const data = await this.adminService.updateStorefrontSettings(body);

    return {
      success: true,
      data,
    };
  }
}
