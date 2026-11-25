import { Module } from '@nestjs/common';
import { NotifierService } from './notifier.service.js';
import { DeadlineWorker } from './deadline.worker.js';

@Module({
  providers: [NotifierService, DeadlineWorker],
  exports: [NotifierService],
})
export class NotificationsModule {}
