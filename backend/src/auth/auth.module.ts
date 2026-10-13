import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma.service.js';

@Module({
    controllers: [AuthController],              // responsible for receiving HTTP request
    providers:  [AuthService, PrismaService],   // handling register, login, password and communicate database through Prisma
    exports: [AuthService],                     // let other module to use AuthService via importing AuthModule
})
export class AuthModule {}