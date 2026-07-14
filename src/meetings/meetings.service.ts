import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { nanoid } from 'nanoid';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import * as path from 'path';
import { DATA_DIR } from '../data-dir.util';
import { UsersService } from '../users/users.service';
import { Role } from '../users/entities/role.enum';

export interface Meeting {
  id: string;
  title: string;
  startsAt: string;          // ISO
  durationMinutes: number;
  channel: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

const STORE_PATH = path.join(DATA_DIR, 'meetings.json');
const ROOM_PING_WINDOW_MS = 30_000;
const SIGNAL_TTL_MS = 60_000;
const MAX_SIGNALS_PER_USER = 200;

export interface RtcSignal {
  from: string;
  fromName: string;
  type: string;      // 'offer' | 'answer' | 'ice'
  data: any;
  at: number;
}

@Injectable()
export class MeetingsService {
  private meetings: Meeting[] = [];
  private saveTimer: NodeJS.Timeout | null = null;
  // meetingId -> userId -> last ping (in-memory: who is in the room right now)
  private rooms = new Map<string, Map<string, number>>();
  // meetingId -> recipient userId -> queued WebRTC signals (drained on poll)
  private signals = new Map<string, Map<string, RtcSignal[]>>();

  constructor(private readonly usersService: UsersService) {
    try {
      const parsed = JSON.parse(fsSync.readFileSync(STORE_PATH, 'utf-8'));
      this.meetings = parsed.meetings || [];
    } catch {
      this.meetings = [];
    }
  }

  private scheduleSave() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(async () => {
      this.saveTimer = null;
      try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.writeFile(STORE_PATH, JSON.stringify({ meetings: this.meetings }, null, 2), 'utf-8');
      } catch (e) {
        console.error('meetings store save failed', e);
      }
    }, 400);
  }

  create(user: { sub: string }, data: { title: string; startsAt: string; durationMinutes?: number; channel?: string }): Meeting {
    const title = (data.title || '').trim();
    if (!title) throw new BadRequestException('title_required');
    const starts = new Date(data.startsAt);
    if (isNaN(starts.getTime())) throw new BadRequestException('invalid_date');
    const creator = this.usersService.findById(user.sub);
    const meeting: Meeting = {
      id: nanoid(12),
      title: title.slice(0, 120),
      startsAt: starts.toISOString(),
      durationMinutes: Math.max(5, Math.min(480, Number(data.durationMinutes) || 30)),
      channel: (data.channel || 'general').trim().slice(0, 40),
      createdBy: user.sub,
      createdByName: creator ? creator.name : '',
      createdAt: new Date().toISOString(),
    };
    this.meetings.push(meeting);
    this.scheduleSave();
    return meeting;
  }

  remove(id: string, user: { sub: string; role?: string }) {
    const m = this.meetings.find((x) => x.id === id);
    if (!m) throw new NotFoundException('meeting_not_found');
    const isAdmin = user.role === Role.OWNER || user.role === Role.ADMIN;
    if (m.createdBy !== user.sub && !isAdmin) throw new ForbiddenException();
    this.meetings = this.meetings.filter((x) => x.id !== id);
    this.rooms.delete(id);
    this.signals.delete(id);
    this.scheduleSave();
    return { ok: true };
  }

  /** Upcoming meetings plus anything that ended less than an hour ago. */
  listUpcoming(): Meeting[] {
    const cutoff = Date.now() - 60 * 60000;
    return this.meetings
      .filter((m) => new Date(m.startsAt).getTime() + m.durationMinutes * 60000 > cutoff)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  ping(meetingId: string, userId: string) {
    const m = this.meetings.find((x) => x.id === meetingId);
    if (!m) throw new NotFoundException('meeting_not_found');
    let room = this.rooms.get(meetingId);
    if (!room) { room = new Map(); this.rooms.set(meetingId, room); }
    room.set(userId, Date.now());
    return this.room(meetingId);
  }

  leave(meetingId: string, userId: string) {
    this.rooms.get(meetingId)?.delete(userId);
    this.signals.get(meetingId)?.delete(userId);
    return { ok: true };
  }

  /** Queue a WebRTC signal for another participant in the same room. */
  sendSignal(meetingId: string, fromUser: { sub: string }, to: string, type: string, data: any) {
    const m = this.meetings.find((x) => x.id === meetingId);
    if (!m) throw new NotFoundException('meeting_not_found');
    const sender = this.usersService.findById(fromUser.sub);
    let perMeeting = this.signals.get(meetingId);
    if (!perMeeting) { perMeeting = new Map(); this.signals.set(meetingId, perMeeting); }
    const queue = perMeeting.get(to) || [];
    queue.push({ from: fromUser.sub, fromName: sender ? sender.name : '', type, data, at: Date.now() });
    perMeeting.set(to, queue.slice(-MAX_SIGNALS_PER_USER));
    return { ok: true };
  }

  /** Drain my pending signals (drops anything older than the TTL). */
  drainSignals(meetingId: string, userId: string): RtcSignal[] {
    const queue = this.signals.get(meetingId)?.get(userId) || [];
    this.signals.get(meetingId)?.set(userId, []);
    const cutoff = Date.now() - SIGNAL_TTL_MS;
    return queue.filter((s) => s.at >= cutoff);
  }

  room(meetingId: string) {
    const room = this.rooms.get(meetingId);
    const participants: Array<{ id: string; name: string; role: string }> = [];
    if (room) {
      for (const [userId, seen] of room) {
        if (Date.now() - seen >= ROOM_PING_WINDOW_MS) continue;
        const u = this.usersService.findById(userId);
        if (u) participants.push({ id: u.id, name: u.name, role: u.role });
      }
    }
    return { participants };
  }
}
