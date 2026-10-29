import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { PrismaService } from '../prisma.service.js';
import {AuthModule} from '../auth/auth.module.js';

@Module({
  controllers: [UsersController],
  providers: [UsersService, PrismaService],
  imports: [AuthModule],
})
export class UsersModule {}