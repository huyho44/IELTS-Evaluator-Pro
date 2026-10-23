import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service.js';
import { SubmissionsService } from './submissions.service.js';
@Controller()
export class SubmissionsController {
  constructor(
    private readonly service: SubmissionsService,
    private readonly auth: AuthService,
  ) {}
  // POST /assignments/:id/attempts
  @Post('assignments/:id/attempts') async start(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') h?: string,
  ) {
    return this.service.start(id, await this.auth.authenticate(h));
  }
  // GET /attempts/:id
  @Get('attempts/:id') async attempt(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') h?: string,
  ) {
    return this.service.attempt(id, await this.auth.authenticate(h));
  }
  // PUT /attempts/:id/draft
  @Put('attempts/:id/draft') async draft(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.service.draft(id, b, await this.auth.authenticate(h));
  }
  // POST /assignments/:id/submissions
  @Post('assignments/:id/submissions') @HttpCode(202) async submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.service.submitAssignment(
      id,
      b,
      await this.auth.authenticate(h),
    );
  }
  // GET /submissions/:id
  @Get('submissions/:id') async details(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') h?: string,
  ) {
    return this.service.getSubmissionById(id, await this.auth.authenticate(h));
  }
  // GET /me/submissions
  @Get('me/submissions') async history(@Headers('authorization') h?: string) {
    return this.service.history(await this.auth.authenticate(h));
  }
}
