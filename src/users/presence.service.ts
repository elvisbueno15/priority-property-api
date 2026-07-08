import { Injectable } from '@nestjs/common';

const ONLINE_WINDOW_MS = 75_000;

@Injectable()
export class PresenceService {
  private readonly lastSeen = new Map<string, number>();

  touch(userId: string) {
    if (userId) this.lastSeen.set(userId, Date.now());
  }

  isOnline(userId: string): boolean {
    const seen = this.lastSeen.get(userId);
    return !!seen && Date.now() - seen < ONLINE_WINDOW_MS;
  }

  onlineIds(): Set<string> {
    const ids = new Set<string>();
    for (const [id, seen] of this.lastSeen) {
      if (Date.now() - seen < ONLINE_WINDOW_MS) ids.add(id);
    }
    return ids;
  }
}
