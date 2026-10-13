import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma.service.js";
import { ExceptionHandler } from "@nestjs/core/errors/exception-handler.js";

@Injectable()
export class CoursesService{
    constructor(private readonly prisma: PrismaService){}

    async findAll(){
        return this.prisma.course.findMany({
            select: {
                id: true,
                title: true,
                description: true,
                createdAt: true,

                // take creator info
                creator: {
                    select: {
                        id: true,
                        email: true,
                        role: true,
                    },
                },
                // count how many lessons and enrollment of courses
                _count: {
                    select: {
                        lesson: true,
                        enrollment: true,
                    },
                },
            },
            //arrange the date creating course by descreasing order
            orderBy: {
                createdAt: 'desc'
            },
        });
    }

    async findOne(id: number) {
        const course = await this.prisma.course.findUnique({
            where: {id},
            include: {
                creator: {
                    select: {
                        id: true,
                        email: true,
                        role: true,
                    },
                },
                lesson: {
                    select: {
                        id: true,
                        title: true,
                        type: true,
                        targetSkillTag: true,
                        contentUrl: true,
                    },
                    orderBy: {
                        id: 'asc'
                    },
                },
                _count: {
                    select: {
                        enrollment: true,
                    },
                },
            },
        });

        if(!course){
            throw new NotFoundException('Cannot find courses with ID: ${id}');
        }
        return course;
    };

    async enrollCourse(courseId: number, UserId: number){
        const course = await this.prisma.course.findUnique({
            where: {id: courseId},
        });
        if(!course){
            throw new NotFoundException('Cannot find courses with ID: ${courseId}');
        }

        const existingEnrollment = await this.prisma.enrollment.findUnique({
            where: {
                userId_courseId: {
                    userId: UserId,
                    courseId: courseId,
                },   
            },
        });
        
        if(existingEnrollment){
            throw new ConflictException("You have already enrolled this course");
        }
        return this.prisma.enrollment.create({
            data: {
                userId: UserId,
                courseId: courseId,
                progressPercentage: 0,
                lastAccessed: new Date(),
            }
        });
    }
}