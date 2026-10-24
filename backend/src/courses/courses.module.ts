import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CoursesController } from './courses.controller.js';
import { CoursesService } from './courses.service.js';
import { CourseAuthoringService } from './course-authoring.service.js';
@Module({
  imports: [AuthModule],
  controllers: [CoursesController],
  providers: [CoursesService, CourseAuthoringService],
  exports: [CoursesService],
})
export class CoursesModule {}
