import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CoursesModule } from './courses/courses.module.js';
import { SubmissionsModule } from './submissions/submissions.module.js';
import { GradingModule } from './grading/grading.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { RecommendationsModule } from './recommendations/recommendations.module.js';


@Module({
  imports: [
    UsersModule,
    AuthModule,
    CoursesModule,
    SubmissionsModule,
    GradingModule,
    ReviewsModule,
    RecommendationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}