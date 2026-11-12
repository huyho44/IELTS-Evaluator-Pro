import {
  Body, UploadedFile, UseInterceptors, BadRequestException,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CoursesService } from './courses.service.js';
import { AuthService } from '../auth/auth.service.js';
import { CourseAuthoringService } from './course-authoring.service.js';
@Controller('courses')
export class CoursesController {
  constructor(
    private readonly courses: CoursesService,
    private readonly auth: AuthService,
    private readonly authoring: CourseAuthoringService,
  ) {}
  // PATCH /courses/:id/content/:itemId/order
  @Patch(':id/content/:itemId/order') async order(@Param('id', ParseUUIDPipe) id: string, @Param('itemId', ParseUUIDPipe) itemId: string, @Body() body: unknown, @Headers('authorization') header?: string) {
    return this.authoring.moveItem(id, itemId, body, await this.auth.authenticate(header));
  }
  // POST /courses/:id/sections
  @Post(':id/sections') async section(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.authoring.section(id, b, await this.auth.authenticate(h));
  }
  // POST /courses/:id/lessons
  @Post(':id/lessons') async addLesson(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.authoring.lesson(id, b, await this.auth.authenticate(h));
  }
  // POST /courses/:id/activities
  @Post(':id/activities') async activity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.authoring.activity(id, b, await this.auth.authenticate(h));
  }
  // POST /courses/:id/objective-activities
  @Post(':id/objective-activities')
  @UseInterceptors(FileInterceptor('audio', { limits: { files: 1, fileSize: 12 * 1024 * 1024, fields: 1, fieldSize: 250000, parts: 3 } }))
  async objective(@Param('id', ParseUUIDPipe) id: string, @Body('activity') activity: string,
    @UploadedFile() audio: { buffer: Buffer; mimetype: string } | undefined, @Headers('authorization') h?: string) {
    const actor = await this.auth.authenticate(h);
    let data: unknown;
    try { data = JSON.parse(activity); } catch { throw new BadRequestException('Invalid activity'); }
    return this.authoring.objective(id, data, actor, audio);
  }
  // POST /courses/:id/assignments
  @Post(':id/assignments') async addAssignment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.authoring.assignment(id, b, await this.auth.authenticate(h));
  }
  // POST /courses/:id/assignments/:assignmentId/versions
  @Post(':id/assignments/:assignmentId/versions') async version(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.authoring.assignment(
      id,
      b,
      await this.auth.authenticate(h),
      assignmentId,
    );
  }
  // GET /courses
  @Get() list() {
    return this.courses.findAll();
  }
  // GET /courses/mine
  @Get('mine') async mine(@Headers('authorization') h?: string) {
    return this.courses.mine(await this.auth.authenticate(h));
  }
  // GET /courses/:id
  @Header('Cache-Control', 'private, no-store')
  @Get(':id')
  async one(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') h?: string,
  ) {
    return this.courses.findOne(
      id,
      h ? await this.auth.authenticate(h) : undefined,
    );
  }
  // POST /courses
  @Post() async create(
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.courses.create(b, await this.auth.authenticate(h));
  }
  // PATCH /courses/:id
  @Patch(':id') async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: unknown,
    @Headers('authorization') h?: string,
  ) {
    return this.courses.update(id, b, await this.auth.authenticate(h));
  }
  // POST /courses/:id/enroll
  @Post(':id/enroll') async enroll(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') h?: string,
  ) {
    return this.courses.enrollCourse(id, await this.auth.authenticate(h));
  }
  // POST /courses/:id/leave
  @Post(':id/leave') async leave(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') h?: string,
  ) {
    return this.courses.leave(id, await this.auth.authenticate(h));
  }
  // GET /courses/:id/assignments
  @Get(':id/assignments') async assignments(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') h?: string,
  ) {
    return this.courses.assignments(id, await this.auth.authenticate(h));
  }
  // GET /courses/:id/lessons/:lessonId
  @Header('Cache-Control', 'private, no-store')
  @Get(':id/lessons/:lessonId')
  async lesson(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Headers('authorization') h?: string,
  ) {
    return this.courses.lesson(id, lessonId, await this.auth.authenticate(h));
  }
  // POST /courses/:id/lessons/:lessonId/complete
  @Post(':id/lessons/:lessonId/complete') async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Headers('authorization') h?: string,
  ) {
    return this.courses.completeLesson(
      id,
      lessonId,
      await this.auth.authenticate(h),
    );
  }
}
