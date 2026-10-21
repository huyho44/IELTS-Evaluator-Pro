import { Module } from '@nestjs/common';
import { GradingController } from './grading.controller.js';
import { GradingService } from './grading.service.js';
import { PrismaService } from '../prisma.service.js';
@Module({
  controllers: [GradingController],
  providers: [GradingService, PrismaService],
  exports: [GradingService],
})
export class GradingModule {}