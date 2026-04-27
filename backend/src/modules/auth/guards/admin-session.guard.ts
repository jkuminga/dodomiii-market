import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

import { AdminRequest } from '../admin-session.types';

@Injectable()
export class AdminSessionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AdminRequest>();

    if (request.session?.admin) {
      return true;
    }

    throw new UnauthorizedException({
      code: 'UNAUTHORIZED',
      message: '관리자 로그인이 필요합니다.',
    });
  }
}
