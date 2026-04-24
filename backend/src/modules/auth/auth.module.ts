import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AdminLoginRateLimitService } from './admin-login-rate-limit.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AdminLoginRateLimitService],
})
export class AuthModule {}
