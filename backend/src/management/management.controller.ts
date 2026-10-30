import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service.js';
import { ManagementService } from './management.service.js';

@Controller()
export class ManagementController {
  constructor(
    private readonly service: ManagementService,
    private readonly auth: AuthService,
  ) {}
  @Get('admin/users') async users(@Headers('authorization') h?: string) {
    return this.service.users(await this.auth.authenticate(h));
  }
  @Patch('admin/users/:id') async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.service.updateUser(id, b, await this.auth.authenticate(h));
  }
  @Post('instructor-applications') async apply(
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.service.apply(b, await this.auth.authenticate(h));
  }
  @Get('me/instructor-applications') async mine(
    @Headers('authorization') h?: string,
  ) {
    return this.service.applications(await this.auth.authenticate(h));
  }
  @Get('admin/instructor-applications') async applications(
    @Headers('authorization') h?: string,
  ) {
    return this.service.applications(await this.auth.authenticate(h), true);
  }
  @Post('admin/instructor-applications/:id/decision') async decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.service.decide(id, b, await this.auth.authenticate(h));
  }
  @Post('courses/:id/instructors') async assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.service.assign(id, b, await this.auth.authenticate(h));
  }
  @Get('skills') async skills(@Headers('authorization') h?: string) {
    return this.service.skills(await this.auth.authenticate(h));
  }
  @Post('skills') async createSkill(
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.service.saveSkill(
      undefined,
      b,
      await this.auth.authenticate(h),
    );
  }
  @Patch('skills/:id') async updateSkill(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.service.saveSkill(id, b, await this.auth.authenticate(h));
  }
  @Delete('skills/:id') async archiveSkill(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') h?: string,
  ) {
    return this.service.saveSkill(
      id,
      { status: 'ARCHIVED' },
      await this.auth.authenticate(h),
    );
  }
  @Put('skills/:id/prerequisites') async prerequisites(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.service.prerequisites(id, b, await this.auth.authenticate(h));
  }
  @Get('authoring/catalog') async catalog(
    @Headers('authorization') h?: string,
  ) {
    return this.service.catalog(await this.auth.authenticate(h));
  }
  @Get('notifications') async notifications(
    @Headers('authorization') h?: string,
  ) {
    return this.service.notifications(await this.auth.authenticate(h));
  }
  @Post('notifications/:id/read') async read(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') h?: string,
  ) {
    return this.service.readNotification(id, await this.auth.authenticate(h));
  }
  @Patch('me/profile') async profile(
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.service.profile(b, await this.auth.authenticate(h));
  }
  @Post('courses/:id/completion') async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') h?: string,
  ) {
    return this.service.completeCourse(id, await this.auth.authenticate(h));
  }
}
