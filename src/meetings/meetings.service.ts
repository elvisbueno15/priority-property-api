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
// Drop meetings that ended more than this ago so the store can't grow forever
// (instant calls create a meeting each time).
const PRUNE_AFTER_MS = 6 * 60 * 60_000;
// Anti-abuse: at most this many instant calls per user inside the window.
const CALL_WINDOW_MS = 60_000;
const MAX_CALLS_PER_WINDOW = 6;

/** A private call's channel is 'dm:<idA>:<idB>'. */
export function isDmChannel(channel: string): boolean {
  return typeof channel === 'string' && channel.startsWith('dm:');
}
/** The two user ids in a 'dm:<idA>:<idB>' channel. */
export function dmParticipants(channel: string): string[] {
  return channel.slice(3).split(':').filter(Boolean);
}

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
  // userId -> recent instant-call timestamps (rate limiting)
  private callTimes = new Map<string, number[]>();

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
      // 80: a DM channel is 'dm:<uuid>:<uuid>' (76 chars) and must survive
      // intact — truncating it would break DM-call privacy checks.
      channel: (data.channel || 'general').trim().slice(0, 80),
      createdBy: user.sub,
      createdByName: creator ? creator.name : '',
      createdAt: new Date().toISOString(),
    };
    // Prune long-ended meetings so instant calls can't grow the store forever.
    const staleCutoff = Date.now() - PRUNE_AFTER_MS;
    this.meetings = this.meetings.filter(
      (x) => new Date(x.startsAt).getTime() + x.durationMinutes * 60000 > staleCutoff,
    );
    this.meetings.push(meeting);
    this.scheduleSave();
    return meeting;
  }

  /** Public-channel calls are company-wide; DM calls only their participants. */
  canAccess(meeting: Meeting, userId: string): boolean {
    if (!isDmChannel(meeting.channel)) return true;
    return meeting.createdBy === userId || dmParticipants(meeting.channel).includes(userId);
  }

  /** Look up a meeting and enforce that `userId` is allowed in its room. */
  assertAccess(meetingId: string, userId: string): Meeting {
    const m = this.meetings.find((x) => x.id === meetingId);
    if (!m) throw new NotFoundException('meeting_not_found');
    if (!this.canAccess(m, userId)) throw new ForbiddenException('not_a_participant');
    return m;
  }

  /** Throttle instant calls per user; throws if over the limit. */
  assertCallAllowed(userId: string) {
    const now = Date.now();
    const recent = (this.callTimes.get(userId) || []).filter((t) => now - t < CALL_WINDOW_MS);
    if (recent.length >= MAX_CALLS_PER_WINDOW) {
      throw new BadRequestException('Too many calls — wait a moment before starting another.');
    }
    recent.push(now);
    this.callTimes.set(userId, recent);
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
    this.assertAccess(meetingId, userId);
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
    const m = this.assertAccess(meetingId, fromUser.sub);
    // The recipient must also be allowed in the room — never relay an intruder in.
    if (!this.canAccess(m, to)) throw new ForbiddenException('recipient_not_a_participant');
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
    this.assertAccess(meetingId, userId);
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
