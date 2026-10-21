import { Controller, Get, Query, ParseIntPipe } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service.js';

@Controller('me')
export class RecommendationsController {
    constructor(private readonly recommendationsService: RecommendationsService){}

    /**
    * GET /me/skills?userId=3
    */
    @Get('skills')
    async getSkills(@Query('userId', ParseIntPipe) userId: number){
        return this.recommendationsService.getLearnerSkills(userId);
    }
    /**
    * GET /me/recommendations?userId=3
    */
    @Get('recommendations')
    async getRecommendations(@Query('userId', ParseIntPipe) userId: number){
        return this.recommendationsService.getRecommendations(userId);
    }
}