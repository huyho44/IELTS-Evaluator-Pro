import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AccessService } from './access.service.js';
import { MailerService } from './mailer.service.js';
@Module({
  controllers: [AuthController],
  providers: [AuthService, AccessService, MailerService],
  exports: [AuthService, AccessService],
})
export class AuthModule {}
