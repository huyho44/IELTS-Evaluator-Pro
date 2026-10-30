import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { GradingController } from './grading.controller.js';
import { GradingService } from './grading.service.js';
import { PublicationService } from './publication.service.js';
import { GradingProvider } from './grading-provider.js';
import { GradingWorker } from './grading.worker.js';
import { GradingConfigService } from './grading-config.service.js';
import { GradingReportService } from './grading-report.service.js';
@Module({
  imports: [AuthModule],
  controllers: [GradingController],
  providers: [
    GradingService,
    PublicationService,
    GradingProvider,
    GradingWorker,
    GradingConfigService,
    GradingReportService,
  ],
  exports: [GradingService, PublicationService],
})
export class GradingModule {}
