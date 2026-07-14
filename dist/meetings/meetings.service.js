"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeetingsService = void 0;
const common_1 = require("@nestjs/common");
const nanoid_1 = require("nanoid");
const fs_1 = require("fs");
const fsSync = __importStar(require("fs"));
const path = __importStar(require("path"));
const users_service_1 = require("../users/users.service");
const role_enum_1 = require("../users/entities/role.enum");
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'meetings.json');
const ROOM_PING_WINDOW_MS = 30_000;
let MeetingsService = class MeetingsService {
    constructor(usersService) {
        this.usersService = usersService;
        this.meetings = [];
        this.saveTimer = null;
        // meetingId -> userId -> last ping (in-memory: who is in the room right now)
        this.rooms = new Map();
        try {
            const parsed = JSON.parse(fsSync.readFileSync(STORE_PATH, 'utf-8'));
            this.meetings = parsed.meetings || [];
        }
        catch {
            this.meetings = [];
        }
    }
    scheduleSave() {
        if (this.saveTimer)
            return;
        this.saveTimer = setTimeout(async () => {
            this.saveTimer = null;
            try {
                await fs_1.promises.mkdir(DATA_DIR, { recursive: true });
                await fs_1.promises.writeFile(STORE_PATH, JSON.stringify({ meetings: this.meetings }, null, 2), 'utf-8');
            }
            catch (e) {
                console.error('meetings store save failed', e);
            }
        }, 400);
    }
    create(user, data) {
        const title = (data.title || '').trim();
        if (!title)
            throw new common_1.BadRequestException('title_required');
        const starts = new Date(data.startsAt);
        if (isNaN(starts.getTime()))
            throw new common_1.BadRequestException('invalid_date');
        const creator = this.usersService.findById(user.sub);
        const meeting = {
            id: (0, nanoid_1.nanoid)(12),
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
    remove(id, user) {
        const m = this.meetings.find((x) => x.id === id);
        if (!m)
            throw new common_1.NotFoundException('meeting_not_found');
        const isAdmin = user.role === role_enum_1.Role.OWNER || user.role === role_enum_1.Role.ADMIN;
        if (m.createdBy !== user.sub && !isAdmin)
            throw new common_1.ForbiddenException();
        this.meetings = this.meetings.filter((x) => x.id !== id);
        this.rooms.delete(id);
        this.scheduleSave();
        return { ok: true };
    }
    /** Upcoming meetings plus anything that ended less than an hour ago. */
    listUpcoming() {
        const cutoff = Date.now() - 60 * 60000;
        return this.meetings
            .filter((m) => new Date(m.startsAt).getTime() + m.durationMinutes * 60000 > cutoff)
            .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    }
    ping(meetingId, userId) {
        const m = this.meetings.find((x) => x.id === meetingId);
        if (!m)
            throw new common_1.NotFoundException('meeting_not_found');
        let room = this.rooms.get(meetingId);
        if (!room) {
            room = new Map();
            this.rooms.set(meetingId, room);
        }
        room.set(userId, Date.now());
        return this.room(meetingId);
    }
    leave(meetingId, userId) {
        this.rooms.get(meetingId)?.delete(userId);
        return { ok: true };
    }
    room(meetingId) {
        const room = this.rooms.get(meetingId);
        const participants = [];
        if (room) {
            for (const [userId, seen] of room) {
                if (Date.now() - seen >= ROOM_PING_WINDOW_MS)
                    continue;
                const u = this.usersService.findById(userId);
                if (u)
                    participants.push({ id: u.id, name: u.name, role: u.role });
            }
        }
        return { participants };
    }
};
exports.MeetingsService = MeetingsService;
exports.MeetingsService = MeetingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService])
], MeetingsService);
//# sourceMappingURL=meetings.service.js.map