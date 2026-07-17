"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsService = void 0;
const common_1 = require("@nestjs/common");
/**
 * Thin wrapper over the Socket.io server so any module can push realtime
 * events without knowing about sockets. The io instance is attached in
 * main.ts after the HTTP server boots; until then emits are no-ops, so the
 * REST polling fallback keeps everything working.
 */
let EventsService = class EventsService {
    constructor() {
        this.io = null;
    }
    bind(io) {
        this.io = io;
    }
    /** Emit to every connected client. */
    emitAll(event, payload = {}) {
        this.io?.emit(event, payload);
    }
    /** Emit to one user's sockets (they join room `u:<id>` on connect). */
    emitToUser(userId, event, payload = {}) {
        if (userId)
            this.io?.to('u:' + userId).emit(event, payload);
    }
};
exports.EventsService = EventsService;
exports.EventsService = EventsService = __decorate([
    (0, common_1.Injectable)()
], EventsService);
//# sourceMappingURL=events.service.js.map