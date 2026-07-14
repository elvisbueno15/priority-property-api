"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PresenceService = void 0;
const common_1 = require("@nestjs/common");
const ONLINE_WINDOW_MS = 75_000;
let PresenceService = class PresenceService {
    constructor() {
        this.lastSeen = new Map();
    }
    touch(userId) {
        if (userId)
            this.lastSeen.set(userId, Date.now());
    }
    isOnline(userId) {
        const seen = this.lastSeen.get(userId);
        return !!seen && Date.now() - seen < ONLINE_WINDOW_MS;
    }
    onlineIds() {
        const ids = new Set();
        for (const [id, seen] of this.lastSeen) {
            if (Date.now() - seen < ONLINE_WINDOW_MS)
                ids.add(id);
        }
        return ids;
    }
};
exports.PresenceService = PresenceService;
exports.PresenceService = PresenceService = __decorate([
    (0, common_1.Injectable)()
], PresenceService);
//# sourceMappingURL=presence.service.js.map