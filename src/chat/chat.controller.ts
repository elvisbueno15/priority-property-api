import { Controller, Get, Post, Delete, Body, Query, Param, Res, Request, UseGuards, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { ChatService, isDmChannel, dmParticipants } from './chat.service';
import { PresenceService } from '../users/presence.service';
import { UsersService } from '../users/users.service';
import { ActivityService } from '../activity/activity.service';
import { EventsService } from '../events/events.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly presence: PresenceService,
    private readonly usersService: UsersService,
    private readonly activity: ActivityService,
    private readonly events: EventsService,
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

  /** Upload a file (base64) to attach to a message; returns its metadata. */
  @Post('upload')
  upload(@Request() req: any, @Body() body: { name: string; mime: string; data: string }) {
    return this.chat.saveAttachment(req.user.sub, body.name, body.mime, body.data);
  }

  @Post('messages')
  post(@Request() req: any, @Body() body: { channel: string; body: string; attachment?: { id: string; name: string; mime: string; size: number } }) {
    this.presence.touch(req.user.sub);
    const user = this.usersService.findById(req.user.sub);
    const name = user ? user.name : req.user.email;
    const channel = body.channel || 'general';
    const msg = this.chat.post(req.user, name, channel, body.body, body.attachment);
    this.notify(req.user.sub, name, channel, msg.body || (msg.attachment ? '📎 ' + msg.attachment.name : ''));
    // Realtime push so open chats refresh instantly (polling stays as fallback).
    // Include sender + a short preview so clients can raise a notification/sound.
    const preview = msg.body ? msg.body.slice(0, 120) : (msg.attachment ? '📎 ' + msg.attachment.name : '');
    const payload = { channel, byId: req.user.sub, byName: name, preview };
    if (isDmChannel(channel)) {
      for (const id of dmParticipants(channel)) this.events.emitToUser(id, 'chat', payload);
    } else {
      this.events.emitAll('chat', payload);
    }
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

/**
 * Serves attachment bytes. Public on purpose: <img> / download links can't send
 * the JWT header, and ids are unguessable (nanoid). Same model as /screenshots.
 */
@Controller('chat')
export class ChatAttachmentController {
  constructor(private readonly chat: ChatService) {}

  @Get('attachment/:id')
  attachment(@Param('id') id: string, @Res() res: Response) {
    const a = this.chat.getAttachment(id);
    if (!a) throw new NotFoundException('not_found');
    res.setHeader('Content-Type', a.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(a.name)}"`);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(Buffer.from(a.data, 'base64'));
  }
}
