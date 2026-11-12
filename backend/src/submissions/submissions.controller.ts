import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  UploadedFile, UseInterceptors, BadRequestException, Header,
  Post,
  Put,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.service.start(id, await this.auth.authenticate(h), b);
  }
  @Post('attempts/:id/revise') async revise(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') h?: string,
  ) {
    return this.service.revise(id, await this.auth.authenticate(h));
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
  // POST /assignments/:id/speaking
  @Post('assignments/:id/speaking') @HttpCode(202)
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 12 * 1024 * 1024, files: 1, fields: 1, parts: 3 } }))
  async speaking(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown,
    @UploadedFile() audio: { buffer: Buffer; mimetype: string } | undefined, @Headers('authorization') header?: string) {
    if (!audio) throw new BadRequestException('A recording is required');
    return this.service.submitAssignment(id, body, await this.auth.authenticate(header), audio);
  }

  // GET /attempts/:id/audio/:assetId
  @Get('attempts/:id/audio/:assetId') @Header('Cache-Control', 'private, no-store')
  audio(@Param('id', ParseUUIDPipe) id: string, @Param('assetId', ParseUUIDPipe) assetId: string, @Headers('authorization') header?: string) {
    return this.auth.authenticate(header).then(actor => this.service.audio(id, assetId, actor));
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
