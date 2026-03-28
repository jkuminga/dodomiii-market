import { Injectable, UnauthorizedException } from '@nestjs/common';
import { compare } from 'bcryptjs';

import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async validateAdmin(loginId: string, password: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { loginId },
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: '아이디 또는 비밀번호가 올바르지 않습니다.',
      });
    }

    const isMatched = await compare(password, admin.passwordHash);
    if (!isMatched) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: '아이디 또는 비밀번호가 올바르지 않습니다.',
      });
    }

    return admin;
  }

  async getAdminMe(adminId: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: BigInt(adminId) },
      select: {
        id: true,
        loginId: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: '세션이 유효하지 않습니다. 다시 로그인해주세요.',
      });
    }

    return {
      adminId: admin.id.toString(),
      loginId: admin.loginId,
      name: admin.name,
      role: admin.role,
      isActive: admin.isActive,
    };
  }
}
