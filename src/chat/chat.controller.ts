import { Controller, Get, Post, Delete, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ChatService, isDmChannel, dmParticipants } from './chat.service';
import { PresenceService } from '../users/presence.service';
import { UsersService } from '../users/users.service';
import { ActivityService } from '../activity/activity.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly presence: PresenceService,
    private readonly usersService: UsersService,
    private readonly activity: ActivityService,
  ) {}

  @Get('channels')
  channels() {
    return this.chat.channels();
  }

  @Get('messages')
  messages(@Request() req: any, @Query('channel') channel = 'general', @Query('after') after?: string) {
    this.presence.touch(req.user.sub);
    return this.chat.list(channel, req.user.sub, after);
  }

  @Delete('messages')
  clear(@Request() req: any, @Query('channel') channel = 'general') {
    return this.chat.clear(channel, req.user);
  }

  @Post('messages')
  post(@Request() req: any, @Body() body: { channel: string; body: string }) {
    this.presence.touch(req.user.sub);
    const user = this.usersService.findById(req.user.sub);
    const name = user ? user.name : req.user.email;
    const channel = body.channel || 'general';
    const msg = this.chat.post(req.user, name, channel, body.body);
    this.notify(req.user.sub, name, channel, msg.body);
    return msg;
  }

  /** Fan out activity: DM recipient, plus anyone @mentioned by name. */
  private notify(senderId: string, senderName: string, channel: string, text: string) {
    if (isDmChannel(channel)) {
      const other = dmParticipants(channel).find((id) => id !== senderId);
      if (other) this.activity.push(other, 'dm', `${senderName} sent you a private message`);
      return;
    }
    if (!text.includes('@')) return;
    const lower = text.toLowerCase();
    for (const u of this.usersService.listPublic()) {
      if (u.id === senderId) continue;
      const first = u.name.split(' ')[0].toLowerCase();
      if (lower.includes('@' + u.name.toLowerCase()) || lower.includes('@' + first)) {
        this.activity.push(u.id, 'mention', `${senderName} mentioned you in #${channel}`);
      }
    }
  }
}
