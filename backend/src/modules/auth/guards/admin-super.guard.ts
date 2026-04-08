import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class AdminSuperGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const sessionAdmin = request.session?.admin;

    if (!sessionAdmin) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: '관리자 로그인이 필요합니다.',
      });
    }

    if (sessionAdmin.role !== 'SUPER') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '슈퍼 관리자 권한이 필요합니다.',
      });
    }

    return true;
  }
}
