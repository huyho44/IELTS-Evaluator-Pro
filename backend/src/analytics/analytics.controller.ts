import { Controller, Get, Header, Headers, Query } from '@nestjs/common';
import { AuthService } from '../auth/auth.service.js';
import { AnalyticsService, type AuditQuery } from './analytics.service.js';

@Controller('admin')
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly auth: AuthService,
  ) {}
  // GET /admin/analytics?courseId= (admins and assigned instructors)
  @Header('Cache-Control', 'private, no-store')
  @Get('analytics')
  async report(
    @Query('courseId') courseId?: string,
    @Headers('authorization') h?: string,
  ) {
    return this.analytics.analytics(await this.auth.authenticate(h), courseId);
  }
  // GET /admin/audit-events?actorId=&action=&entityType=&entityKey=&from=&to=&cursor=&limit=
  @Header('Cache-Control', 'private, no-store')
  @Get('audit-events')
  async audit(
    @Query() query: AuditQuery,
    @Headers('authorization') h?: string,
  ) {
    return this.analytics.auditEvents(await this.auth.authenticate(h), query);
  }
}
