import { Controller, Get } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';

@Controller('warmup')
export class WarmupController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async warmup() {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      success: true,
      data: {
        status: 'warm',
      },
    };
  }
}
