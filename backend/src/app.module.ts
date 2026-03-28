import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import envConfig from './common/config/env.config';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [envConfig],
    }),
    HealthModule,
  ],
})
export class AppModule {}
