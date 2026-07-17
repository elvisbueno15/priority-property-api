import { Controller, Get, Post, Delete, Body, Param, Request, UseGuards } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { PresenceService } from '../users/presence.service';
import { UsersService } from '../users/users.service';
import { ActivityService } from '../activity/activity.service';
import { EventsService } from '../events/events.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { Role } from '../users/entities/role.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('meetings')
export class MeetingsController {
  constructor(
    private readonly meetings: MeetingsService,
    private readonly presence: PresenceService,
    private readonly usersService: UsersService,
    private readonly activity: ActivityService,
    private readonly events: EventsService,
  ) {}

  @Get()
  list(@Request() req: any) {
    this.presence.touch(req.user.sub);
    return this.meetings.listUpcoming();
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Post()
  create(@Request() req: any, @Body() body: { title: string; startsAt: string; durationMinutes?: number; channel?: string }) {
    const meeting = this.meetings.create(req.user, body);
    const others = this.usersService.listPublic().filter((u) => u.id !== req.user.sub).map((u) => u.id);
    const when = new Date(meeting.startsAt).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
    this.activity.pushMany(others, 'meeting', `New meeting scheduled: ${meeting.title} — ${when}`);
    this.events.emitAll('meeting', {});
    return meeting;
  }

  /**
   * Start an instant call (any role). Creates a "right now" meeting bound to a
   * chat channel and rings the target: a single teammate for a DM call, or
   * everyone else for a channel call.
   */
  @Post('call')
  startCall(@Request() req: any, @Body() body: { channel?: string; title?: string; toUserId?: string }) {
    const meeting = this.meetings.create(req.user, {
      title: (body.title || 'Call').slice(0, 120),
      startsAt: new Date().toISOString(),
      durationMinutes: 60,
      channel: body.channel || 'general',
    });
    const caller = this.usersService.findById(req.user.sub);
    const callerName = caller ? caller.name : 'Someone';
    const targets = body.toUserId
      ? [body.toUserId]
      : this.usersService.listPublic().filter((u) => u.id !== req.user.sub).map((u) => u.id);
    this.activity.pushMany(targets, 'meeting', `📞 ${callerName} started a call: ${meeting.title}`);
    this.events.emitAll('call', {
      meetingId: meeting.id,
      channel: meeting.channel,
      byId: req.user.sub,
      byName: callerName,
      toUserId: body.toUserId || null,
    });
    this.events.emitAll('meeting', {});
    return meeting;
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    const out = this.meetings.remove(id, req.user);
    this.events.emitAll('meeting', {});
    return out;
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

  @Post(':id/signal')
  signal(@Request() req: any, @Param('id') id: string, @Body() body: { to: string; type: string; data: any }) {
    return this.meetings.sendSignal(id, req.user, body.to, body.type, body.data);
  }

  @Get(':id/signals')
  signals(@Request() req: any, @Param('id') id: string) {
    this.presence.touch(req.user.sub);
    return this.meetings.drainSignals(id, req.user.sub);
  }

  @Get(':id/room')
  room(@Param('id') id: string) {
    return this.meetings.room(id);
  }
}
