import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service.js';
import { DiscussionsService } from './discussions.service.js';

@Controller()
export class DiscussionsController {
  constructor(
    private readonly discussions: DiscussionsService,
    private readonly auth: AuthService,
  ) {}
  // GET /discussions/courses
  @Header('Cache-Control', 'private, no-store')
  @Get('discussions/courses')
  async courses(@Headers('authorization') h?: string) {
    return this.discussions.staffCourses(await this.auth.authenticate(h));
  }
  // GET /courses/:id/threads?contextItemId=
  @Header('Cache-Control', 'private, no-store')
  @Get('courses/:id/threads')
  async list(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('contextItemId') contextItemId?: string,
    @Headers('authorization') h?: string,
  ) {
    return this.discussions.list(
      await this.auth.authenticate(h),
      id,
      contextItemId,
    );
  }
  // POST /courses/:id/threads
  @Post('courses/:id/threads') async create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.discussions.create(await this.auth.authenticate(h), id, b);
  }
  // GET /threads/:id
  @Header('Cache-Control', 'private, no-store')
  @Get('threads/:id')
  async detail(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') h?: string,
  ) {
    return this.discussions.detail(await this.auth.authenticate(h), id);
  }
  // POST /threads/:id/posts
  @Post('threads/:id/posts') async reply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.discussions.reply(await this.auth.authenticate(h), id, b);
  }
  // POST /threads/:id/lock
  @Post('threads/:id/lock') async lock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.discussions.lock(await this.auth.authenticate(h), id, b);
  }
  // PATCH /posts/:id
  @Patch('posts/:id') async edit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.discussions.edit(await this.auth.authenticate(h), id, b);
  }
  // DELETE /posts/:id
  @Delete('posts/:id') async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') h?: string,
  ) {
    return this.discussions.remove(await this.auth.authenticate(h), id);
  }
}
