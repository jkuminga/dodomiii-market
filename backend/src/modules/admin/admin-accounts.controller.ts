import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AdminRequest } from '../auth/admin-session.types';
import { AdminSuperGuard } from '../auth/guards/admin-super.guard';
import { AdminSessionGuard } from '../auth/guards/admin-session.guard';
import { AdminAccountsService } from './admin-accounts.service';
import { AdminAccountIdParamDto } from './dto/admin-account-id-param.dto';
import { CreateAdminAccountDto } from './dto/create-admin-account.dto';
import { UpdateAdminAccountDto } from './dto/update-admin-account.dto';

@UseGuards(AdminSessionGuard, AdminSuperGuard)
@Controller('admin/accounts')
export class AdminAccountsController {
  constructor(private readonly adminAccountsService: AdminAccountsService) {}

  @Get()
  async getAccounts() {
    const data = await this.adminAccountsService.getAccounts();

    return {
      success: true,
      data,
    };
  }

  @Post()
  async createAccount(@Body() body: CreateAdminAccountDto) {
    const data = await this.adminAccountsService.createAccount(body);

    return {
      success: true,
      data,
    };
  }

  @Patch(':adminId')
  async updateAccount(
    @Param() params: AdminAccountIdParamDto,
    @Body() body: UpdateAdminAccountDto,
    @Req() request: AdminRequest,
  ) {
    const data = await this.adminAccountsService.updateAccount(
      params.adminId,
      Number(request.session.admin!.adminId),
      body,
    );

    return {
      success: true,
      data,
    };
  }

  @Delete(':adminId')
  async deleteAccount(
    @Param() params: AdminAccountIdParamDto,
    @Req() request: AdminRequest,
  ) {
    const data = await this.adminAccountsService.deleteAccount(
      params.adminId,
      Number(request.session.admin!.adminId),
    );

    return {
      success: true,
      data,
    };
  }
}
