import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DiscussionsModule } from '../discussions/discussions.module.js';
import { ModerationController } from './moderation.controller.js';
import { ModerationService } from './moderation.service.js';

@Module({
  imports: [AuthModule, DiscussionsModule],
  controllers: [ModerationController],
  providers: [ModerationService],
})
export class ModerationModule {}
