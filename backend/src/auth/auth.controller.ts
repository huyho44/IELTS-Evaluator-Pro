import {Controller, Post, Get, Body, Headers, HttpCode, HttpStatus, UnauthorizedException }
from '@nestjs/common'

import { AuthService } from './auth.service.js'
import { LoginDto } from './dto/login.dto.js'
import { RegisterDto } from './dto/register.dto.js'

@Controller('auth')             //API always start with http://localhost:3000/auth
export class AuthController {
    constructor(private readonly AuthService: AuthService) {}

      /**
   * API: POST http://localhost:3000/auth/register
   * JSON data is sent : { "email", "password", "targetBand"}
  */
    @Post('register')
    async register(@Body() registerDto: RegisterDto){
        return this.AuthService.register(registerDto);
    }
    /**
     * API: POST http://localhost:3000/auth/login
     * Httpcode : when login successfully, return OK
     */
    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(@Body() loginDto: LoginDto){
        return this.AuthService.login(loginDto);
    }
    /**
     * API: GET http://localhost:3000/auth/me
     * Take user current info by encoding token sent in Header
     */
    @Get('me')
    async getProfile(@Headers('authorization') authHeader?: string){
        if(!authHeader){
            throw new UnauthorizedException('Missing Authorization Header');
        }

        try{
            //cut Bearer to take token string
            const token = authHeader.replace('Bearer', '');

            //Encoding token base64
            const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));

            return this.AuthService.getProfile(decoded.sub);
        }
        catch{
            throw new UnauthorizedException('Invalid Authorization Header');
        }
    }
}
