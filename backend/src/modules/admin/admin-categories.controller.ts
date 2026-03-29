import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { AdminSessionGuard } from '../auth/guards/admin-session.guard';
import { CreateAdminCategoryDto } from './dto/create-admin-category.dto';
import { AdminCategoryIdParamDto } from './dto/admin-category-id-param.dto';
import { UpdateAdminCategoryDto } from './dto/update-admin-category.dto';
import { AdminService } from './admin.service';

@UseGuards(AdminSessionGuard)
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly adminService: AdminService) {}

  @Post()
  async createCategory(@Body() body: CreateAdminCategoryDto) {
    const data = await this.adminService.createCategory(body);

    return {
      success: true,
      data,
    };
  }

  @Get()
  async getCategories() {
    const data = await this.adminService.getCategories();

    return {
      success: true,
      data,
    };
  }

  @Patch(':categoryId')
  async updateCategory(
    @Param() params: AdminCategoryIdParamDto,
    @Body() body: UpdateAdminCategoryDto,
  ) {
    const data = await this.adminService.updateCategory(params.categoryId, body);

    return {
      success: true,
      data,
    };
  }

  @Delete(':categoryId')
  async deleteCategory(@Param() params: AdminCategoryIdParamDto) {
    const data = await this.adminService.deleteCategory(params.categoryId);

    return {
      success: true,
      data,
    };
  }
}
