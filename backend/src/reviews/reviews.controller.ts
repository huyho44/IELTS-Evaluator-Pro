import { Controller, Get, Post, Param, Body, ParseIntPipe } from '@nestjs/common';
import { ReviewsService } from './reviews.service.js';
import { ConfirmReviewDto } from './dto/confirm-review.dto.js';

@Controller()
export class ReviewsController {
    constructor(private readonly reviewsService: ReviewsService){}

    /**
     * GET /teacher/reviews
     */
    @Get('teacher/reviews')
    async getQueue(){
        return this.reviewsService.getTeacherQueue();
    }

    /**
     * POST /reviews/:id/claim
     */

    @Post('reviews/:id/claim')
    async claim(
        @Param('id',ParseIntPipe) id: number,
        @Body('teacherId', ParseIntPipe) teacherId: number,
    ){
        return this.reviewsService.claimSubmission(id,teacherId);
    }

    /**
     * POST /reviews/:id/confirm
     */

    @Post('reviews/:id/confirm')
    async confirm(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: ConfirmReviewDto,
    ) {
        return this.reviewsService.confirmReview(id,dto);
    }

    /**
     * POST /assessments/:id/appeals
     */
    @Post('assessments/:id/appeals')
    async appeal(
        @Param('id', ParseIntPipe) id: number,
        @Body('reason') reason: string,
        @Body('userId', ParseIntPipe) userId: number,
    ) {
        return this.reviewsService.createAppeal(id,reason,userId);
    }
}