import { Controller, Get, Post, Delete, Body, Param, Request, UseGuards, ForbiddenException } from '@nestjs/common';
import { MeetingsService, isDmChannel, dmParticipants } from './meetings.service';
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
    // Private (DM) calls are only visible to their two participants — the
    // channel is 'dm:<idA>:<idB>', so membership is an id match.
    return this.meetings
      .listUpcoming()
      .filter((m) => !m.channel.startsWith('dm:') || m.channel.includes(req.user.sub) || m.createdBy === req.user.sub);
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
    const me = req.user.sub;
    this.meetings.assertCallAllowed(me);
    const channel = body.channel || 'general';
    // For a private call the caller must actually be one of the two people in
    // the DM channel — otherwise they can't forge a call into someone else's DM.
    const dm = isDmChannel(channel);
    if (dm) {
      const parts = dmParticipants(channel);
      if (parts.length !== 2 || !parts.includes(me)) throw new ForbiddenException('not_your_dm');
    }
    const meeting = this.meetings.create(req.user, {
      title: (body.title || 'Call').slice(0, 120),
      startsAt: new Date().toISOString(),
      durationMinutes: 60,
      channel,
    });
    const caller = this.usersService.findById(me);
    const callerName = caller ? caller.name : 'Someone';
    const payload = { meetingId: meeting.id, channel: meeting.channel, byId: me, byName: callerName, toUserId: dm ? dmParticipants(channel).find((id) => id !== me) || null : null };

    if (dm) {
      // Ring ONLY the other participant — never broadcast a private call's id.
      const other = payload.toUserId;
      if (other) {
        this.activity.pushMany([other], 'meeting', `📞 ${callerName} is calling you`);
        this.events.emitToUser(other, 'call', payload);
      }
    } else {
      const others = this.usersService.listPublic().filter((u) => u.id !== me).map((u) => u.id);
      this.activity.pushMany(others, 'meeting', `📞 ${callerName} started a call: ${meeting.title}`);
      this.events.emitAll('call', payload);
    }
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
  room(@Request() req: any, @Param('id') id: string) {
    this.meetings.assertAccess(id, req.user.sub);
    return this.meetings.room(id);
  }
}
