import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import envConfig from './common/config/env.config';
import { PrismaModule } from './common/prisma/prisma.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { StoreModule } from './modules/store/store.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [envConfig],
    }),
    PrismaModule,
    AdminModule,
    AuthModule,
    HealthModule,
    StoreModule,
  ],
})
export class AppModule {}
