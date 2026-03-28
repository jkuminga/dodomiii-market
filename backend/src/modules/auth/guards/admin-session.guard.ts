import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class AdminSessionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (request.session?.admin) {
      return true;
    }

    throw new UnauthorizedException({
      code: 'UNAUTHORIZED',
      message: '관리자 로그인이 필요합니다.',
    });
  }
}
