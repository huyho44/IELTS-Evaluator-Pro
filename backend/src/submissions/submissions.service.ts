import {Injectable, NotFoundException} from '@nestjs/common'
import { PrismaService } from '../prisma.service.js'
import { CreateSubmissionDto } from './dto/create-submission.dto.js'
import { createHash } from 'crypto'

@Injectable()
export class SubmissionsService {
    constructor (private readonly prisma : PrismaService){}

    /**
     * Create a new submission revision
     * Fix the content hash, and do not overwrite existing submission
     */

    async submitAssignment(lessonId: number, dto: CreateSubmissionDto){
        const lesson = await this.prisma.lesson.findUnique({
            where: {id:lessonId}
        });
        if (!lesson){
            throw new NotFoundException('Cannot find a lesson/test with ID:" $(lessonId)');
        }

        // 1. Find/Create TestSession
        let session = await this.prisma.testSession.findFirst({
            where: {
                userId: dto.userId,
                lessonId: lessonId,
                status: 'IN_PROGRESS'
            },
        });

        if (!session){
            session = await this.prisma.testSession.create({
                data: {
                    userId: dto.userId,
                    lessonId: lessonId,
                    startTime: new Date(),
                    status: 'IN_PROGRESS'
                },
            });
        }

        // 2. calculated the hash codes to prevent data duplication

        const contentHash = createHash('sha256').update(dto.contentText).digest('hex')

        // 3. Create a submission record if doesnt exist and assign a revision

        const submission = await this.prisma.submissions.create({
            data: {
                testSessionId:  session.id,
                type: dto.type ?? 'WRITING',
                contentText: dto.contentText,
            },
        });

        // 4. Create Initial temporary AI evaluation (Generate Grading)

        const initialEvaluation = await this.prisma.evaluation.create({
            data: {
                submissionId: submission.id,
                evaluatorType: 'AI_PENDING',
                feedbackJson: {
                    contentHash,
                    submittedAt: new Date(),
                    status: 'QUEUED',
                },
            },
        });

        return{
            statusCode: 202,
            message: 'The submission has been successfully received and placed in the review queue',
            submissionId: submission.id,
            testSessionId: session.id,
            gradingRunId: initialEvaluation.id,
        };
    }
    async getSubmissionById(id:number){
        const submission = await this.prisma.submissions.findUnique({
            where: {id},
            include: {
                testSession: {
                    include: {
                        user: {select: {id: true, email: true}},
                        lesson: true,
                    },
                },
                evaluation: true,
            },
        });
        if(!submission){
            throw new NotFoundException('Cannot find the submission');
        }
        return submission;
    }
}