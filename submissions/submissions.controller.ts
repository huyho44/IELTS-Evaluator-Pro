import { Controller, Post, Get, Param, Body, ParseIntPipe, HttpCode, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { SubmissionsService } from './submissions.service.js';
import { CreateSubmissionDto } from './dto/create-submission.dto.js';

@Controller()
export class SubmissionsController {
    constructor(private readonly SubmissionsService: SubmissionsService) {}

    /**
     * POST /assignment/:id/submission
     *  Return HTTP 202 accepted
     */

    @Post('assignments/:id/submissions')
    @HttpCode(HttpStatus.ACCEPTED)
    async submit(
        @Param('id', ParseIntPipe) assignmentId : number,
        @Body() dto: CreateSubmissionDto,
    ){
        return this.SubmissionsService.submitAssignment(assignmentId,dto);
    }

    @Get('submissions/:id')
    async getDetails(@Param('id', ParseIntPipe) id: number){
        return this.SubmissionsService.getSubmissionById(id);
    }
}