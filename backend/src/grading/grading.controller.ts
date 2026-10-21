import { Controller, Get, Post, Param, ParseIntPipe } from '@nestjs/common';
import { GradingService } from './grading.service.js';

@Controller()
export class GradingController {
    constructor(private readonly gradingService: GradingService){}


    /**
     * GET /grading-runs/:id
     */
    @Get('grading-runs/:id')
    async getStatus(@Param('id', ParseIntPipe) id: number){
        return this.gradingService.getGradingRunStatus(id);
    }

    /**
     * GET /submission-revision/:id/assessment
     */
    @Get('submission-revision/:id/assessment')
    async getAssessment(@Param('id', ParseIntPipe) id: number){
        return this.gradingService.getAssessmentSubmission(id);
    }

    /**
     * POST /grading/simulate/:submissionId 
     */
    @Post('grading/simulate/:submissionId')
    async triggerSimulation(@Param('submissionId', ParseIntPipe) submissionId: number){
        return this.gradingService.simulateAIEvaluation(submissionId);
    }
}