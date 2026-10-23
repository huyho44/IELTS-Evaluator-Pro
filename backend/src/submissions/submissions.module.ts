import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { GradingModule } from '../grading/grading.module.js';
import { SubmissionsController } from './submissions.controller.js';
import { SubmissionsService } from './submissions.service.js';
@Module({
  imports: [AuthModule, GradingModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
