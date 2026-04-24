import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';
import { AdminSessionGuard } from './guards/admin-session.guard';

@Controller('admin/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() request: Request) {
    const admin = await this.authService.validateAdmin(dto.loginId, dto.password);

    request.session.admin = {
      adminId: admin.id.toString(),
      loginId: admin.loginId,
      role: admin.role,
      name: admin.name,
    };

    await new Promise<void>((resolve, reject) => {
      request.session.save((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    return {
      success: true,
      data: {
        admin: {
          adminId: admin.id.toString(),
          loginId: admin.loginId,
          name: admin.name,
          role: admin.role,
        },
      },
    };
  }

  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await new Promise<void>((resolve, reject) => {
      request.session.destroy((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    response.clearCookie(this.configService.get<string>('SESSION_NAME', 'admin_session'));

    return {
      success: true,
      data: {
        loggedOut: true,
      },
    };
  }

  @Get('me')
  @UseGuards(AdminSessionGuard)
  async me(@Req() request: Request) {
    const sessionAdmin = request.session.admin;
    if (!sessionAdmin) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: '세션이 없습니다.',
      });
    }

    const me = await this.authService.getAdminMe(sessionAdmin.adminId);

    return {
      success: true,
      data: me,
    };
  }
}
