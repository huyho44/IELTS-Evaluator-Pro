import { Module } from "@nestjs/common";
import { CoursesController } from "./courses.controller.js";
import { CoursesService } from "./courses.service.js";
import { PrismaService } from "../prisma.service.js";

@Module({
    controllers: [CoursesController],
    providers: [CoursesService, PrismaService],
    exports: [CoursesService],
})
export class CourseModule{}