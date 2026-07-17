import { Injectable, BadRequestException } from '@nestjs/common';
import { nanoid } from 'nanoid';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import * as path from 'path';
import { DATA_DIR } from '../data-dir.util';

export interface ChatMessage {
  id: string;
  channel: string;
  userId: string;
  name: string;
  body: string;
  at: string;
}

const STORE_PATH = path.join(DATA_DIR, 'chat.json');
const MAX_PER_CHANNEL = 2000;
const PAGE_SIZE = 100;

export const CHANNELS = ['general', 'support', 'executives'];

/**
 * Direct-message channels look like `dm:<idA>:<idB>` with the two user ids
 * sorted, so both sides always compute the same channel name.
 */
export function isDmChannel(channel: string): boolean {
  return channel.startsWith('dm:') && channel.split(':').length === 3;
}
export function dmParticipants(channel: string): string[] {
  return channel.split(':').slice(1);
}

@Injectable()
export class ChatService {
  private messages: ChatMessage[] = [];
  private saveTimer: NodeJS.Timeout | null = null;

  constructor() {
    try {
      const parsed = JSON.parse(fsSync.readFileSync(STORE_PATH, 'utf-8'));
      this.messages = parsed.messages || [];
    } catch {
      this.messages = [];
    }
  }

  private scheduleSave() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(async () => {
      this.saveTimer = null;
      try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.writeFile(STORE_PATH, JSON.stringify({ messages: this.messages }, null, 2), 'utf-8');
      } catch (e) {
        console.error('chat store save failed', e);
      }
    }, 400);
  }

  channels() {
    return CHANNELS;
  }

  /** Public channels are open to everyone; a DM only to its two participants. */
  private assertAccess(channel: string, userId: string) {
    if (CHANNELS.includes(channel)) return;
    if (isDmChannel(channel) && dmParticipants(channel).includes(userId)) return;
    throw new BadRequestException('unknown_channel');
  }

  list(channel: string, userId: string, afterId?: string): ChatMessage[] {
    this.assertAccess(channel, userId);
    const inChannel = this.messages.filter((m) => m.channel === channel);
    if (afterId) {
      const idx = inChannel.findIndex((m) => m.id === afterId);
      if (idx >= 0) return inChannel.slice(idx + 1);
    }
    return inChannel.slice(-PAGE_SIZE);
  }

  clear(channel: string, user: { sub: string; role?: string }) {
    if (CHANNELS.includes(channel)) {
      if (user.role !== 'owner' && user.role !== 'admin') throw new BadRequestException('admin_required');
    } else {
      this.assertAccess(channel, user.sub);
    }
    this.messages = this.messages.filter((m) => m.channel !== channel);
    this.scheduleSave();
    return { ok: true };
  }

  post(user: { sub: string; email: string }, name: string, channel: string, body: string): ChatMessage {
    this.assertAccess(channel, user.sub);
    const text = (body || '').trim();
    if (!text) throw new BadRequestException('empty_message');
    const msg: ChatMessage = {
      id: nanoid(12),
      channel,
      userId: user.sub,
      name,
      body: text.slice(0, 4000),
      at: new Date().toISOString(),
    };
    this.messages.push(msg);
    const inChannel = this.messages.filter((m) => m.channel === channel);
    if (inChannel.length > MAX_PER_CHANNEL) {
      const dropId = inChannel[0].id;
      this.messages = this.messages.filter((m) => m.id !== dropId);
    }
    this.scheduleSave();
    return msg;
  }
}
