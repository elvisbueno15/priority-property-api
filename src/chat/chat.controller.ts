import { Controller, Get, Post, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { PresenceService } from '../users/presence.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly presence: PresenceService,
    private readonly usersService: UsersService,
  ) {}

  @Get('channels')
  channels() {
    return this.chat.channels();
  }

  @Get('messages')
  messages(@Request() req: any, @Query('channel') channel = 'general', @Query('after') after?: string) {
    this.presence.touch(req.user.sub);
    return this.chat.list(channel, after);
  }

  @Post('messages')
  post(@Request() req: any, @Body() body: { channel: string; body: string }) {
    this.presence.touch(req.user.sub);
    const user = this.usersService.findById(req.user.sub);
    const name = user ? user.name : req.user.email;
    return this.chat.post(req.user, name, body.channel || 'general', body.body);
  }
}
