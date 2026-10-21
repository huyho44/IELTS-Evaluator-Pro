import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class GradingService {
    constructor(private readonly prisma: PrismaService){}

    /**
     * Read gradung run status 
     * GET /grading-runs/:id
     */

    async getGradingRunStatus(id: number){
        const evaluation = await this.prisma.evaluation.findUnique({
            where: {id},
            include: {
                submission: {
                    select: {id: true, contentText: true, testSessionId: true},
                },
            },
        });

        if(!evaluation){
            throw new NotFoundException(`Không tìm thấy phiên chấm ID: ${id}`);
        }

        return {
            gradingRunId: evaluation.id,
            evaluationType: evaluation.evaluatorType,
            overallBand: evaluation.overallBand,
            scores: {
                TA: evaluation.scoreTa,
                CC: evaluation.scoreCc,
                LR: evaluation.scoreLr,
                GRA: evaluation.scoreGra,
            },
            details: evaluation.feedbackJson,
        };
    }

    async getAssessmentSubmission(submissionId: number){
        const evaluation = await this.prisma.evaluation.findMany({
            where: {submissionId},
            include: {
                evaluator: {
                    select: {id: true, email:true, role: true},
                },
                rubricDescriptors: true,
            },
            orderBy: {id: 'desc'}
        });

        return {
            submissionId,
            assessments: evaluation,
            isOfficial: evaluation.some((e) => e.evaluatorType === 'TEACHER'),
        };
    }

    /**
     * AI-based analyzer for generating findings and evidence
     */

    async simulateAIEvaluation(submissionId: number){
        const submission = await this.prisma.submissions.findUnique({
            where: {id: submissionId},
        });
        if(!submission || !submission.contentText){
            throw new NotFoundException('Cannot find an answer subission')
        }

        const paragraphs = submission.contentText.split('\n\n').filter(p => p.trim().length > 0);

        const findings = [
            {
                criterion: 'CC',
                paragraphId: 1,
                quote: paragraphs[0]?.slice(0, 50) || '',
                message: 'The opening paragraph is clear but lacking transitional words to connect ideas',
            },
            {
                criterion: 'GRA',
                paragraphId: 2,
                quote: paragraphs[1]?.slice(0, 40) || '',
                message: 'There is an error in the struture of complex sentence',
            },
        ];
    
        return this.prisma.evaluation.create({
            data:{
                submissionId,
                evaluatorType: 'AI_PROVISIONAL',
                scoreTa: 6.5,
                scoreCc: 6.0,
                scoreLr: 6.5,
                scoreGra: 6.0,
                overallBand: 6.5,
                feedbackJson: {
                    status: 'COMPLETED',
                    findings,
                    summary: 'The essays covers all the necessary points; however, it would benefits from more advanced academic vocabulary and improved coherence between paragraphs.'
                },
            },
        });
    }
}