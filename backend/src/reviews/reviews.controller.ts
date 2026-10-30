import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service.js';
import { ReviewsService } from './reviews.service.js';
@Controller()
export class ReviewsController {
  constructor(
    private readonly service: ReviewsService,
    private readonly auth: AuthService,
  ) {}
  // GET /teacher/reviews
  @Get('teacher/reviews') async queue(
    @Headers('authorization') h?: string,
    @Query('status') status?: string,
  ) {
    return this.service.getTeacherQueue(
      await this.auth.authenticate(h),
      status,
    );
  }
  @Post('submission-revisions/:id/review-requests') async request(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.service.requestReview(id, b, await this.auth.authenticate(h));
  }
  @Post('reviews/:id/release') async release(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.service.release(id, b, await this.auth.authenticate(h));
  }
  @Post('reviews/:id/reopen') async reopen(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.service.reopen(id, b, await this.auth.authenticate(h));
  }
  // GET /reviews/:id
  @Get('reviews/:id') async details(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') h?: string,
  ) {
    return this.service.details(id, await this.auth.authenticate(h));
  }
  // POST /reviews/:id/claim
  @Post('reviews/:id/claim') async claim(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') h?: string,
  ) {
    return this.service.claimSubmission(id, await this.auth.authenticate(h));
  }
  // POST /reviews/:id/confirm
  @Post('reviews/:id/confirm') async confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.service.confirmReview(id, b, await this.auth.authenticate(h));
  }
  // POST /reviews/:id/resolve
  @Post('reviews/:id/resolve') async resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.service.resolve(id, b, await this.auth.authenticate(h));
  }
  // POST /assessments/:id/appeals
  @Post('assessments/:id/appeals') async appeal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.service.createAppeal(id, b, await this.auth.authenticate(h));
  }
  // POST /assessments/:id/publish
  @Post('assessments/:id/publish') async publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') h?: string,
  ) {
    return this.service.publish(id, await this.auth.authenticate(h));
  }
}
