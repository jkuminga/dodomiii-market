import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { AdminSessionGuard } from '../auth/guards/admin-session.guard';
import { CreateAdminProductDto } from './dto/create-admin-product.dto';
import { AdminProductIdParamDto } from './dto/admin-product-id-param.dto';
import { GetAdminProductsQueryDto } from './dto/get-admin-products.query.dto';
import { UpdateAdminProductDto } from './dto/update-admin-product.dto';
import { AdminService } from './admin.service';

@UseGuards(AdminSessionGuard)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly adminService: AdminService) {}

  @Post()
  async createProduct(@Body() body: CreateAdminProductDto) {
    const data = await this.adminService.createProduct(body);

    return {
      success: true,
      data,
    };
  }

  @Get()
  async getProducts(@Query() query: GetAdminProductsQueryDto) {
    const result = await this.adminService.getProducts(query);

    return {
      success: true,
      data: {
        items: result.items,
      },
      meta: result.meta,
    };
  }

  @Get(':productId')
  async getProduct(@Param() params: AdminProductIdParamDto) {
    const data = await this.adminService.getProduct(params.productId);

    return {
      success: true,
      data,
    };
  }

  @Patch(':productId')
  async updateProduct(
    @Param() params: AdminProductIdParamDto,
    @Body() body: UpdateAdminProductDto,
  ) {
    const data = await this.adminService.updateProduct(params.productId, body);

    return {
      success: true,
      data,
    };
  }

  @Delete(':productId')
  async deleteProduct(@Param() params: AdminProductIdParamDto) {
    const data = await this.adminService.deleteProduct(params.productId);

    return {
      success: true,
      data,
    };
  }
}
