import { Controller, Get, Header, Headers } from '@nestjs/common';
import { AuthService } from '../auth/auth.service.js';
import { CoursesService } from './courses.service.js';

@Controller('me')
export class LearningController {
  constructor(
    private readonly courses: CoursesService,
    private readonly auth: AuthService,
  ) {}
  // GET /me/learning-overview
  @Header('Cache-Control', 'private, no-store')
  @Get('learning-overview')
  async overview(@Headers('authorization') h?: string) {
    return this.courses.learningOverview(await this.auth.authenticate(h));
  }
}
