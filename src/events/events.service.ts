import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

/**
 * Thin wrapper over the Socket.io server so any module can push realtime
 * events without knowing about sockets. The io instance is attached in
 * main.ts after the HTTP server boots; until then emits are no-ops, so the
 * REST polling fallback keeps everything working.
 */
@Injectable()
export class EventsService {
  private io: Server | null = null;

  bind(io: Server) {
    this.io = io;
  }

  /** Emit to every connected client. */
  emitAll(event: string, payload: any = {}) {
    this.io?.emit(event, payload);
  }

  /** Emit to one user's sockets (they join room `u:<id>` on connect). */
  emitToUser(userId: string, event: string, payload: any = {}) {
    if (userId) this.io?.to('u:' + userId).emit(event, payload);
  }
}
