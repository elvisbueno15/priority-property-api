import { Controller, Get, Post, Delete, Body, Param, Request, UseGuards } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { PresenceService } from '../users/presence.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { Role } from '../users/entities/role.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('meetings')
export class MeetingsController {
  constructor(
    private readonly meetings: MeetingsService,
    private readonly presence: PresenceService,
  ) {}

  @Get()
  list(@Request() req: any) {
    this.presence.touch(req.user.sub);
    return this.meetings.listUpcoming();
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Post()
  create(@Request() req: any, @Body() body: { title: string; startsAt: string; durationMinutes?: number; channel?: string }) {
    return this.meetings.create(req.user, body);
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.meetings.remove(id, req.user);
  }

  @Post(':id/ping')
  ping(@Request() req: any, @Param('id') id: string) {
    this.presence.touch(req.user.sub);
    return this.meetings.ping(id, req.user.sub);
  }

  @Post(':id/leave')
  leave(@Request() req: any, @Param('id') id: string) {
    return this.meetings.leave(id, req.user.sub);
  }

  @Get(':id/room')
  room(@Param('id') id: string) {
    return this.meetings.room(id);
  }
}
