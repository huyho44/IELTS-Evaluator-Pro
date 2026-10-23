import { Controller, Get, Headers } from '@nestjs/common';
import { AuthService } from '../auth/auth.service.js';
import { RecommendationsService } from './recommendations.service.js';
@Controller('me')
export class RecommendationsController {
  constructor(
    private readonly service: RecommendationsService,
    private readonly auth: AuthService,
  ) {}
  // GET /me/skills
  @Get('skills') async skills(@Headers('authorization') h?: string) {
    return this.service.getLearnerSkills(await this.auth.authenticate(h));
  }
  // GET /me/recommendations
  @Get('recommendations') async recommendations(
    @Headers('authorization') h?: string,
  ) {
    return this.service.getRecommendations(await this.auth.authenticate(h));
  }
}
