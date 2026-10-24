import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service.js';
import { GradingService } from './grading.service.js';
import { GradingConfigService } from './grading-config.service.js';
@Controller()
export class GradingController {
  constructor(
    private readonly service: GradingService,
    private readonly auth: AuthService,
    private readonly config: GradingConfigService,
  ) {}
  // POST /grading/rubrics
  @Post('grading/rubrics') async rubric(
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.config.rubric(b, await this.auth.authenticate(h));
  }
  // POST /grading/configs
  @Post('grading/configs') async configure(
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.config.config(b, await this.auth.authenticate(h));
  }
  // POST /submission-revisions/:id/grading-runs
  @Post('submission-revisions/:id/grading-runs') async regrade(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.service.requestRegrade(id, b, await this.auth.authenticate(h));
  }
  // GET /grading-runs/:id
  @Get('grading-runs/:id') async status(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') h?: string,
  ) {
    return this.service.getGradingRunStatus(
      id,
      await this.auth.authenticate(h),
    );
  }
  // GET /submission-revision/:id/assessment | GET /submission-revisions/:id/assessment
  @Get([
    'submission-revision/:id/assessment',
    'submission-revisions/:id/assessment',
  ])
  async assessment(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') h?: string,
  ) {
    return this.service.getAssessmentSubmission(
      id,
      await this.auth.authenticate(h),
    );
  }
}
