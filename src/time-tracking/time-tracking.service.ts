import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { nanoid } from 'nanoid';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import * as path from 'path';
import { DATA_DIR } from '../data-dir.util';
import { TimeTrackingSettings } from './entities/time-tracking.types';
import { UsersService } from '../users/users.service';
import { Role } from '../users/entities/role.enum';

export interface TimeEntryRow {
  id: string;
  userId: string;
  projectId: string;
  startTime: string;
  endTime: string | null;
  status: 'active' | 'inactive' | 'paused' | 'unknown';
  activityPercent: number;
  idleTimeMs: number;
  createdAt: string;
  updatedAt: string;
}

export interface UsageRow {
  id: string;
  userId: string;
  appName: string;
  windowTitle: string;
  capturedAt: string;
}

export interface ScreenshotRow {
  id: string;
  userId: string;
  capturedAt: string;
  path: string;
  dataUrl?: string; // durable base64 (survives restarts via db-sync); disk file is best-effort
}

interface TrackingStore {
  entries: TimeEntryRow[];
  usage: Record<string, UsageRow[]>;
  screenshots: Record<string, ScreenshotRow[]>;
  settings: Record<string, TimeTrackingSettings>;
}

const STORE_PATH = path.join(DATA_DIR, 'tracking.json');
const SCREENSHOT_DIR = path.join(DATA_DIR, 'screenshots');
const SHOTS_PER_ENTRY = 24;   // retention cap so tracking.json (synced to Supabase) stays bounded
const MAX_USAGE_PER_ENTRY = 1000;

const now = () => new Date().toISOString();

@Injectable()
export class TimeTrackingService {
  private store: TrackingStore = { entries: [], usage: {}, screenshots: {}, settings: {} };
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(private readonly usersService: UsersService) {
    this.load();
  }

  private load() {
    try {
      const raw = fsSync.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      this.store = {
        entries: parsed.entries || [],
        usage: parsed.usage || {},
        screenshots: parsed.screenshots || {},
        settings: parsed.settings || {},
      };
    } catch {
      this.store = { entries: [], usage: {}, screenshots: {}, settings: {} };
    }
  }

  private scheduleSave() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(async () => {
      this.saveTimer = null;
      try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.writeFile(STORE_PATH, JSON.stringify(this.store, null, 2), 'utf-8');
      } catch (e) {
        console.error('tracking store save failed', e);
      }
    }, 400);
  }

  private ensureUser(userId: string) {
    const user = this.usersService.findById(userId);
    if (!user) throw new NotFoundException('user_not_found');
    return user;
  }

  private getOwnedEntry(entryId: string, userId: string, role?: string) {
    const entry = this.store.entries.find((e) => e.id === entryId);
    if (!entry) throw new NotFoundException('session_not_found');
    const isAdmin = role === Role.OWNER || role === Role.ADMIN;
    if (entry.userId !== userId && !isAdmin) throw new ForbiddenException();
    return entry;
  }

  getActiveEntry(userId: string): TimeEntryRow | null {
    return (
      this.store.entries
        .filter((e) => e.userId === userId && e.endTime === null)
        .sort((a, b) => b.startTime.localeCompare(a.startTime))[0] || null
    );
  }

  startSession(userId: string, projectId = 'general'): TimeEntryRow {
    this.ensureUser(userId);
    const active = this.getActiveEntry(userId);
    if (active) return active;
    const entry: TimeEntryRow = {
      id: nanoid(12),
      userId,
      projectId,
      startTime: now(),
      endTime: null,
      status: 'active',
      activityPercent: 100,
      idleTimeMs: 0,
      createdAt: now(),
      updatedAt: now(),
    };
    this.store.entries.push(entry);
    this.scheduleSave();
    return entry;
  }

  private closeEntry(entryId: string, userId: string, role: string | undefined, status: TimeEntryRow['status']) {
    const entry = this.getOwnedEntry(entryId, userId, role);
    if (entry.endTime) return entry;
    entry.endTime = now();
    entry.status = status;
    entry.updatedAt = now();
    this.scheduleSave();
    return entry;
  }

  pauseSession(entryId: string, userId: string, role?: string) {
    return this.closeEntry(entryId, userId, role, 'paused');
  }

  stopSession(entryId: string, userId: string, role?: string) {
    return this.closeEntry(entryId, userId, role, 'inactive');
  }

  // A paused entry is closed for good; resuming starts a fresh entry so the
  // paused gap never counts as worked time.
  resumeSession(entryId: string, userId: string, role?: string) {
    const prev = this.getOwnedEntry(entryId, userId, role);
    return this.startSession(prev.userId, prev.projectId);
  }

  listEntries(userId: string, from?: string, to?: string) {
    return this.store.entries
      .filter((e) => {
        if (e.userId !== userId) return false;
        if (from && e.startTime < from) return false;
        if (to && e.startTime > to) return false;
        return true;
      })
      .sort((a, b) => b.startTime.localeCompare(a.startTime));
  }

  updateActivity(entryId: string, userId: string, percent: number, idleMs: number, role?: string) {
    const entry = this.getOwnedEntry(entryId, userId, role);
    if (entry.endTime) return entry;
    entry.activityPercent = Math.max(0, Math.min(100, Math.round(percent)));
    entry.idleTimeMs = Math.max(0, Math.round(idleMs));
    entry.status = entry.activityPercent < 25 ? 'inactive' : 'active';
    entry.updatedAt = now();
    this.scheduleSave();
    return entry;
  }

  addUsage(entryId: string, userId: string, appName: string, windowTitle: string, role?: string) {
    const entry = this.getOwnedEntry(entryId, userId, role);
    const arr = this.store.usage[entry.id] || [];
    arr.push({ id: nanoid(10), userId: entry.userId, appName, windowTitle, capturedAt: now() });
    this.store.usage[entry.id] = arr.slice(-MAX_USAGE_PER_ENTRY);
    this.scheduleSave();
    return { ok: true };
  }

  listUsage(entryId: string) {
    return this.store.usage[entryId] || [];
  }

  async addScreenshot(entryId: string, userId: string, imageBase64: string, role?: string) {
    const entry = this.getOwnedEntry(entryId, userId, role);
    const data = (imageBase64 || '').replace(/^data:image\/\w+;base64,/, '');
    if (!data) throw new BadRequestException('empty_image');
    const fileName = `${entry.id}-${Date.now()}.jpg`;
    // Best-effort disk write (fast serving in this container); the durable copy
    // is the base64 in the row, which rides db-sync to Supabase and survives
    // restarts/redeploys (the disk folder does not).
    try {
      await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
      await fs.writeFile(path.join(SCREENSHOT_DIR, fileName), Buffer.from(data, 'base64'));
    } catch {}
    const rec: ScreenshotRow = {
      id: nanoid(10),
      userId: entry.userId,
      capturedAt: now(),
      path: `/screenshots/${fileName}`,
      dataUrl: 'data:image/jpeg;base64,' + data,
    };
    const arr = this.store.screenshots[entry.id] || [];
    arr.push(rec);
    // Keep only the most recent shots per entry so tracking.json stays bounded.
    if (arr.length > SHOTS_PER_ENTRY) arr.splice(0, arr.length - SHOTS_PER_ENTRY);
    this.store.screenshots[entry.id] = arr;
    this.pruneOldScreenshots();
    this.scheduleSave();
    return { id: rec.id, userId: rec.userId, capturedAt: rec.capturedAt, path: rec.path };
  }

  /** Drop screenshots attached to entries that started more than 3 days ago. */
  private pruneOldScreenshots() {
    const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
    for (const entry of this.store.entries) {
      if (new Date(entry.startTime).getTime() < cutoff && this.store.screenshots[entry.id]) {
        delete this.store.screenshots[entry.id];
      }
    }
  }

  listScreenshots(entryId: string) {
    return this.store.screenshots[entryId] || [];
  }

  getSettings(userId: string): TimeTrackingSettings {
    return this.store.settings[userId] || { screenshotIntervalMinutes: 10, allowMonitoring: true };
  }

  updateSettings(userId: string, settings: TimeTrackingSettings) {
    this.store.settings[userId] = settings;
    this.scheduleSave();
    return settings;
  }

  /** Worked ms today for a user: entries are clipped to local midnight. */
  msToday(userId: string, ref = new Date()): number {
    const dayStart = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()).getTime();
    const nowMs = ref.getTime();
    let total = 0;
    for (const e of this.store.entries) {
      if (e.userId !== userId) continue;
      const start = Math.max(new Date(e.startTime).getTime(), dayStart);
      const end = e.endTime ? new Date(e.endTime).getTime() : nowMs;
      if (end > start) total += end - start;
    }
    return total;
  }

  daySummary(userId: string) {
    const active = this.getActiveEntry(userId);
    return {
      msToday: this.msToday(userId),
      tracking: !!active,
      activeEntry: active,
      activityPercent: active ? active.activityPercent : null,
    };
  }

  /** All screenshots for a user across today's entries, newest first. */
  userScreenshots(userId: string, limit = 60) {
    const out: ScreenshotRow[] = [];
    for (const entry of this.store.entries) {
      if (entry.userId !== userId) continue;
      for (const s of this.store.screenshots[entry.id] || []) out.push(s);
    }
    out.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
    return out.slice(0, limit);
  }

  teamSummary(onlineIds: Set<string>) {
    const users = this.usersService.listPublic();
    return users.map((u) => {
      const active = this.getActiveEntry(u.id);
      const usage = active ? this.store.usage[active.id] || [] : [];
      const shots = active ? this.store.screenshots[active.id] || [] : [];
      const lastUsage = usage[usage.length - 1];
      const lastShot = shots[shots.length - 1];
      return {
        ...u,
        online: onlineIds.has(u.id),
        tracking: !!active,
        activityPercent: active ? active.activityPercent : null,
        msToday: this.msToday(u.id),
        lastApp: lastUsage ? lastUsage.appName : null,
        lastWindowTitle: lastUsage ? lastUsage.windowTitle : null,
        lastScreenshot: lastShot ? (lastShot.dataUrl || lastShot.path) : null,
        activeEntryId: active ? active.id : null,
      };
    });
  }
}
