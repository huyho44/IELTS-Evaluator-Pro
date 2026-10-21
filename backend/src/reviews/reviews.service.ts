
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { ConfirmReviewDto } from './dto/confirm-review.dto.js';

@Injectable()
export class ReviewsService{
    constructor(private readonly prisma: PrismaService){}

    /**
     * GET /teacher/reviews
     * Retrieve the queue of submissions awaiting instructor review
     */
  async getTeacherQueue() {
    return this.prisma.submissions.findMany({
      where: {
        evaluation: {
          some: {
            evaluatorType: { in: ['AI_PENDING', 'AI_PROVISIONAL'] },
          },
        },
      },
      include: {
        testSession: {
          include: {
            user: { select: { id: true, email: true, targetBand: true } },
            lesson: { select: { id: true, title: true } },
          },
        },
        evaluation: true,
      },
      orderBy: { id: 'asc' },
    });
  }
  /**
   *  POST /reviews/:id/claim
   *  Teacher receive 1 submission 
  */
  async claimSubmission(submissionId: number, teacherId: number){
    const submission = await this.prisma.submissions.findUnique({
        where: {id : submissionId},
    });
    
    if(!submission){
        throw new NotFoundException('Cannot find the submission');
    }
    return {
        message: 'Receive submission successfully',
        submissionId,
        assignedTeacherId: teacherId,
        claimedAt: new Date(),
    };
  }

  /**
   * POST /review/:id/confirm
   * Teacher finalizes the grades
   */

  async confirmReview(submissionId: number, dto: ConfirmReviewDto){
    const overall = dto.overallBand ?? Math.round(((dto.scoreTa + dto.scoreCc + dto.scoreLr + dto.scoreGra) / 4) * 2) / 2;

    const officialEvaluation = await this.prisma.evaluation.create({
        data: {
            submissionId,
            evaluatorType: 'TEACHER',
            evaluatorId: dto.teacherId,
            scoreTa: dto.scoreTa,
            scoreCc: dto.scoreCc,
            scoreLr: dto.scoreLr,
            scoreGra: dto.scoreGra,
            overallBand: overall,
            feedbackJson: {
                teacherFeedback: dto.teacherFeedback,
                confirmedAt : new Date(),
                isOfficial: true,
            },
        },
    });

    return {
        message: 'Official grading results have been successfully confirmed',
        evaluation: officialEvaluation,
    };
  }
  

  /**
   * POST /assessment/:id/appeals
   * Student send an appeals to remark the submission
   */
  async createAppeal(evaluationId: number, reason: string, userId: number){
    const evaluation = await this.prisma.evaluation.findUnique({
        where: {id: evaluationId},
    });
    if(!evaluation){
        throw new NotFoundException('Review to be re-evaluated not found')
    }
    return {
        message: 'The request for a re-evaluated has been sent to the teacher in charge',
        evaluationId,
        userId,
        reason,
        status: 'PENDING_REVIEW',
        createdAt: new Date(),
    };
  }
}