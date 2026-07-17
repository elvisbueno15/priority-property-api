"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityService = void 0;
const common_1 = require("@nestjs/common");
const nanoid_1 = require("nanoid");
const events_service_1 = require("../events/events.service");
const MAX_PER_USER = 100;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * In-memory per-user activity feed. Not persisted on purpose — it is a
 * live "what happened while you were away" list, cheap to rebuild.
 */
let ActivityService = class ActivityService {
    constructor(events) {
        this.events = events;
        this.byUser = new Map();
    }
    push(userId, kind, text) {
        if (!userId)
            return;
        const list = this.byUser.get(userId) || [];
        list.push({ id: (0, nanoid_1.nanoid)(8), userId, kind, text, at: Date.now(), read: false });
        this.byUser.set(userId, list.slice(-MAX_PER_USER));
        this.events.emitToUser(userId, 'activity', { kind });
    }
    pushMany(userIds, kind, text) {
        for (const id of userIds)
            this.push(id, kind, text);
    }
    list(userId) {
        const cutoff = Date.now() - TTL_MS;
        const list = (this.byUser.get(userId) || []).filter((a) => a.at >= cutoff);
        this.byUser.set(userId, list);
        return [...list].reverse();
    }
    unreadCount(userId) {
        return (this.byUser.get(userId) || []).filter((a) => !a.read).length;
    }
    markAllRead(userId) {
        for (const a of this.byUser.get(userId) || [])
            a.read = true;
        return { ok: true };
    }
};
exports.ActivityService = ActivityService;
exports.ActivityService = ActivityService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [events_service_1.EventsService])
], ActivityService);
//# sourceMappingURL=activity.service.js.map