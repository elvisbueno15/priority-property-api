import { Controller, Post, Body, Query, UseGuards, Request, Get, Param, Put } from '@nestjs/common';
import { TimeTrackingService } from './time-tracking.service';
import { PresenceService } from '../users/presence.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { Role } from '../users/entities/role.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('time-tracking')
export class TimeTrackingController {
  constructor(
    private readonly service: TimeTrackingService,
    private readonly presence: PresenceService,
  ) {}

  @Post('start')
  start(@Request() req: any, @Body() body: { projectId?: string }) {
    this.presence.touch(req.user.sub);
    return this.service.startSession(req.user.sub, body?.projectId || 'general');
  }

  @Post('pause')
  pause(@Request() req: any, @Body() body: { entryId: string }) {
    return this.service.pauseSession(body.entryId, req.user.sub, req.user.role);
  }

  @Post('resume')
  resume(@Request() req: any, @Body() body: { entryId: string }) {
    this.presence.touch(req.user.sub);
    return this.service.resumeSession(body.entryId, req.user.sub, req.user.role);
  }

  @Post('stop')
  stop(@Request() req: any, @Body() body: { entryId: string }) {
    return this.service.stopSession(body.entryId, req.user.sub, req.user.role);
  }

  @Get('active')
  active(@Request() req: any) {
    this.presence.touch(req.user.sub);
    return this.service.getActiveEntry(req.user.sub);
  }

  @Get('summary')
  summary(@Request() req: any) {
    this.presence.touch(req.user.sub);
    return this.service.daySummary(req.user.sub);
  }

  @Get('history')
  history(@Request() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.listEntries(req.user.sub, from, to);
  }

  @Post('activity')
  activity(@Request() req: any, @Body() body: { entryId: string; percent: number; idleMs: number }) {
    this.presence.touch(req.user.sub);
    return this.service.updateActivity(body.entryId, req.user.sub, body.percent, body.idleMs, req.user.role);
  }

  @Post('usage')
  usage(@Request() req: any, @Body() body: { entryId: string; appName: string; windowTitle?: string }) {
    return this.service.addUsage(body.entryId, req.user.sub, body.appName || '', body.windowTitle || '', req.user.role);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Get('usage/:entryId')
  listUsage(@Param('entryId') entryId: string) {
    return this.service.listUsage(entryId);
  }

  @Post('screenshots')
  screenshots(@Request() req: any, @Body() body: { entryId: string; imageBase64: string }) {
    return this.service.addScreenshot(body.entryId, req.user.sub, body.imageBase64, req.user.role);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Get('screenshots/:entryId')
  listScreenshots(@Param('entryId') entryId: string) {
    return this.service.listScreenshots(entryId);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Get('team')
  team() {
    return this.service.teamSummary(this.presence.onlineIds());
  }

  @Get('settings')
  settings(@Request() req: any) {
    return this.service.getSettings(req.user.sub);
  }

  @Put('settings')
  updateSettings(@Request() req: any, @Body() body: { screenshotIntervalMinutes?: number; allowMonitoring?: boolean }) {
    const current = this.service.getSettings(req.user.sub);
    return this.service.updateSettings(req.user.sub, {
      screenshotIntervalMinutes: body.screenshotIntervalMinutes ?? current.screenshotIntervalMinutes,
      allowMonitoring: body.allowMonitoring ?? current.allowMonitoring,
    });
  }
}
