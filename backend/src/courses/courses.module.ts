import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CoursesController } from './courses.controller.js';
import { LearningController } from './learning.controller.js';
import { CoursesService } from './courses.service.js';
import { CourseAuthoringService } from './course-authoring.service.js';
import { QuizAuthoringService } from './quiz-authoring.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [CoursesController, LearningController],
  providers: [CoursesService, CourseAuthoringService, QuizAuthoringService],
  exports: [CoursesService],
})
export class CoursesModule {}
