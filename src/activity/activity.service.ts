import { Injectable } from '@nestjs/common';
import { nanoid } from 'nanoid';

export interface ActivityItem {
  id: string;
  userId: string;      // recipient
  kind: string;        // 'mention' | 'dm' | 'meeting' | 'role' | 'shift'
  text: string;
  at: number;
  read: boolean;
}

const MAX_PER_USER = 100;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * In-memory per-user activity feed. Not persisted on purpose — it is a
 * live "what happened while you were away" list, cheap to rebuild.
 */
@Injectable()
export class ActivityService {
  private byUser = new Map<string, ActivityItem[]>();

  push(userId: string, kind: string, text: string) {
    if (!userId) return;
    const list = this.byUser.get(userId) || [];
    list.push({ id: nanoid(8), userId, kind, text, at: Date.now(), read: false });
    this.byUser.set(userId, list.slice(-MAX_PER_USER));
  }

  pushMany(userIds: string[], kind: string, text: string) {
    for (const id of userIds) this.push(id, kind, text);
  }

  list(userId: string): ActivityItem[] {
    const cutoff = Date.now() - TTL_MS;
    const list = (this.byUser.get(userId) || []).filter((a) => a.at >= cutoff);
    this.byUser.set(userId, list);
    return [...list].reverse();
  }

  unreadCount(userId: string): number {
    return (this.byUser.get(userId) || []).filter((a) => !a.read).length;
  }

  markAllRead(userId: string) {
    for (const a of this.byUser.get(userId) || []) a.read = true;
    return { ok: true };
  }
}
