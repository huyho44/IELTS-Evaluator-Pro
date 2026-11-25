import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service.js';
import { ModerationService } from './moderation.service.js';

@Controller('moderation/reports')
export class ModerationController {
  constructor(
    private readonly moderation: ModerationService,
    private readonly auth: AuthService,
  ) {}
  // POST /moderation/reports
  @Post() async report(
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.moderation.report(await this.auth.authenticate(h), b);
  }
  // GET /moderation/reports?status=
  @Header('Cache-Control', 'private, no-store')
  @Get()
  async list(
    @Query('status') status?: string,
    @Headers('authorization') h?: string,
  ) {
    return this.moderation.list(await this.auth.authenticate(h), status);
  }
  // POST /moderation/reports/:id/resolve
  @Post(':id/resolve') @HttpCode(200) async resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.moderation.resolve(await this.auth.authenticate(h), id, b);
  }
  // POST /moderation/reports/:id/dismiss
  @Post(':id/dismiss') @HttpCode(200) async dismiss(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.moderation.dismiss(await this.auth.authenticate(h), id, b);
  }
}
