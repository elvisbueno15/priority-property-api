import { Injectable, BadRequestException } from '@nestjs/common';
import { nanoid } from 'nanoid';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import * as path from 'path';
import { DATA_DIR } from '../data-dir.util';

export interface AttachmentMeta {
  id: string;
  name: string;
  mime: string;
  size: number;
}
export interface ChatMessage {
  id: string;
  channel: string;
  userId: string;
  name: string;
  body: string;
  at: string;
  attachment?: AttachmentMeta;
}
interface StoredAttachment extends AttachmentMeta {
  data: string; // base64 (no data: prefix)
  by: string;
  at: string;
}

const STORE_PATH = path.join(DATA_DIR, 'chat.json');
const ATTACH_PATH = path.join(DATA_DIR, 'attachments.json');
const MAX_PER_CHANNEL = 2000;
const PAGE_SIZE = 100;
const MAX_FILE_BYTES = 8 * 1024 * 1024;      // 8 MB per file
const MAX_TOTAL_BYTES = 60 * 1024 * 1024;    // keep the attachment store bounded
const ALLOWED_MIME = /^(image\/(png|jpe?g|gif|webp|bmp)|application\/pdf|text\/plain|application\/(msword|vnd\.openxmlformats-officedocument\.\w+|vnd\.ms-excel|zip)|audio\/\w+|video\/\w+)$/i;

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
  private attachments: StoredAttachment[] = [];
  private saveTimer: NodeJS.Timeout | null = null;
  private attachTimer: NodeJS.Timeout | null = null;

  constructor() {
    try {
      const parsed = JSON.parse(fsSync.readFileSync(STORE_PATH, 'utf-8'));
      this.messages = parsed.messages || [];
    } catch {
      this.messages = [];
    }
    try {
      const parsed = JSON.parse(fsSync.readFileSync(ATTACH_PATH, 'utf-8'));
      this.attachments = parsed.attachments || [];
    } catch {
      this.attachments = [];
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

  private scheduleAttachSave() {
    if (this.attachTimer) return;
    this.attachTimer = setTimeout(async () => {
      this.attachTimer = null;
      try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.writeFile(ATTACH_PATH, JSON.stringify({ attachments: this.attachments }, null, 2), 'utf-8');
      } catch (e) {
        console.error('attachment store save failed', e);
      }
    }, 400);
  }

  /** Store an uploaded file (base64) and return its public metadata. */
  saveAttachment(by: string, name: string, mime: string, dataUrlOrB64: string): AttachmentMeta {
    const clean = String(dataUrlOrB64 || '').replace(/^data:[^;]+;base64,/, '');
    if (!clean) throw new BadRequestException('empty_file');
    if (!ALLOWED_MIME.test(mime || '')) throw new BadRequestException('unsupported_file_type');
    const size = Math.floor((clean.length * 3) / 4);
    if (size > MAX_FILE_BYTES) throw new BadRequestException('file_too_large');
    const rec: StoredAttachment = {
      id: nanoid(14),
      name: (name || 'file').slice(0, 200),
      mime,
      size,
      data: clean,
      by,
      at: new Date().toISOString(),
    };
    this.attachments.push(rec);
    // Bound the store: drop oldest until under the total budget.
    let total = this.attachments.reduce((s, a) => s + a.size, 0);
    while (total > MAX_TOTAL_BYTES && this.attachments.length > 1) {
      const dropped = this.attachments.shift();
      total -= dropped ? dropped.size : 0;
    }
    this.scheduleAttachSave();
    return { id: rec.id, name: rec.name, mime: rec.mime, size: rec.size };
  }

  getAttachment(id: string): StoredAttachment | undefined {
    return this.attachments.find((a) => a.id === id);
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

  post(user: { sub: string; email: string }, name: string, channel: string, body: string, attachment?: AttachmentMeta): ChatMessage {
    this.assertAccess(channel, user.sub);
    const text = (body || '').trim();
    if (!text && !attachment) throw new BadRequestException('empty_message');
    const msg: ChatMessage = {
      id: nanoid(12),
      channel,
      userId: user.sub,
      name,
      body: text.slice(0, 4000),
      at: new Date().toISOString(),
      ...(attachment ? { attachment } : {}),
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
