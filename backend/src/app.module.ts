import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthController } from './health.controller.js';
import { PrismaModule } from './prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CoursesModule } from './courses/courses.module.js';
import { SubmissionsModule } from './submissions/submissions.module.js';
import { GradingModule } from './grading/grading.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { RecommendationsModule } from './recommendations/recommendations.module.js';
import { ManagementModule } from './management/management.module.js';
import { DiscussionsModule } from './discussions/discussions.module.js';
import { ModerationModule } from './moderation/moderation.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    AuthModule,
    CoursesModule,
    SubmissionsModule,
    GradingModule,
    ReviewsModule,
    RecommendationsModule,
    ManagementModule,
    DiscussionsModule,
    ModerationModule,
    AnalyticsModule,
    NotificationsModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
