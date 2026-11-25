import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DiscussionsController } from './discussions.controller.js';
import { DiscussionsService } from './discussions.service.js';

@Module({
  imports: [AuthModule],
  controllers: [DiscussionsController],
  providers: [DiscussionsService],
})
export class DiscussionsModule {}
