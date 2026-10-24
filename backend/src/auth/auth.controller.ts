import { Body, Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  // POST /auth/register
  @Post('register') register(@Body() body: unknown) {
    return this.auth.register(body);
  }
  // POST /auth/login
  @Post('login') @HttpCode(200) login(@Body() body: unknown) {
    return this.auth.login(body);
  }
  // POST /auth/refresh
  @Post('refresh') @HttpCode(200) refresh(@Body() body: unknown) {
    return this.auth.refresh(body);
  }
  // POST /auth/logout
  @Post('logout') @HttpCode(200) logout(
    @Headers('authorization') header?: string,
  ) {
    return this.auth.logout(header);
  }
  // GET /auth/me
  @Get('me') me(@Headers('authorization') header?: string) {
    return this.auth.authenticate(header);
  }
}
