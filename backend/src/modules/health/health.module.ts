import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';
import { WarmupController } from './warmup.controller';

@Module({
  controllers: [HealthController, WarmupController],
})
export class HealthModule {}
