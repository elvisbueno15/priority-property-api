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
exports.TimeTrackingService = void 0;
const common_1 = require("@nestjs/common");
const nanoid_1 = require("nanoid");
const fs_1 = require("fs");
const fsSync = __importStar(require("fs"));
const path = __importStar(require("path"));
const data_dir_util_1 = require("../data-dir.util");
const users_service_1 = require("../users/users.service");
const role_enum_1 = require("../users/entities/role.enum");
const STORE_PATH = path.join(data_dir_util_1.DATA_DIR, 'tracking.json');
const SCREENSHOT_DIR = path.join(data_dir_util_1.DATA_DIR, 'screenshots');
const MAX_USAGE_PER_ENTRY = 1000;
const now = () => new Date().toISOString();
let TimeTrackingService = class TimeTrackingService {
    constructor(usersService) {
        this.usersService = usersService;
        this.store = { entries: [], usage: {}, screenshots: {}, settings: {} };
        this.saveTimer = null;
        this.load();
    }
    load() {
        try {
            const raw = fsSync.readFileSync(STORE_PATH, 'utf-8');
            const parsed = JSON.parse(raw);
            this.store = {
                entries: parsed.entries || [],
                usage: parsed.usage || {},
                screenshots: parsed.screenshots || {},
                settings: parsed.settings || {},
            };
        }
        catch {
            this.store = { entries: [], usage: {}, screenshots: {}, settings: {} };
        }
    }
    scheduleSave() {
        if (this.saveTimer)
            return;
        this.saveTimer = setTimeout(async () => {
            this.saveTimer = null;
            try {
                await fs_1.promises.mkdir(data_dir_util_1.DATA_DIR, { recursive: true });
                await fs_1.promises.writeFile(STORE_PATH, JSON.stringify(this.store, null, 2), 'utf-8');
            }
            catch (e) {
                console.error('tracking store save failed', e);
            }
        }, 400);
    }
    ensureUser(userId) {
        const user = this.usersService.findById(userId);
        if (!user)
            throw new common_1.NotFoundException('user_not_found');
        return user;
    }
    getOwnedEntry(entryId, userId, role) {
        const entry = this.store.entries.find((e) => e.id === entryId);
        if (!entry)
            throw new common_1.NotFoundException('session_not_found');
        const isAdmin = role === role_enum_1.Role.OWNER || role === role_enum_1.Role.ADMIN;
        if (entry.userId !== userId && !isAdmin)
            throw new common_1.ForbiddenException();
        return entry;
    }
    getActiveEntry(userId) {
        return (this.store.entries
            .filter((e) => e.userId === userId && e.endTime === null)
            .sort((a, b) => b.startTime.localeCompare(a.startTime))[0] || null);
    }
    startSession(userId, projectId = 'general') {
        this.ensureUser(userId);
        const active = this.getActiveEntry(userId);
        if (active)
            return active;
        const entry = {
            id: (0, nanoid_1.nanoid)(12),
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
    closeEntry(entryId, userId, role, status) {
        const entry = this.getOwnedEntry(entryId, userId, role);
        if (entry.endTime)
            return entry;
        entry.endTime = now();
        entry.status = status;
        entry.updatedAt = now();
        this.scheduleSave();
        return entry;
    }
    pauseSession(entryId, userId, role) {
        return this.closeEntry(entryId, userId, role, 'paused');
    }
    stopSession(entryId, userId, role) {
        return this.closeEntry(entryId, userId, role, 'inactive');
    }
    // A paused entry is closed for good; resuming starts a fresh entry so the
    // paused gap never counts as worked time.
    resumeSession(entryId, userId, role) {
        const prev = this.getOwnedEntry(entryId, userId, role);
        return this.startSession(prev.userId, prev.projectId);
    }
    listEntries(userId, from, to) {
        return this.store.entries
            .filter((e) => {
            if (e.userId !== userId)
                return false;
            if (from && e.startTime < from)
                return false;
            if (to && e.startTime > to)
                return false;
            return true;
        })
            .sort((a, b) => b.startTime.localeCompare(a.startTime));
    }
    updateActivity(entryId, userId, percent, idleMs, role) {
        const entry = this.getOwnedEntry(entryId, userId, role);
        if (entry.endTime)
            return entry;
        entry.activityPercent = Math.max(0, Math.min(100, Math.round(percent)));
        entry.idleTimeMs = Math.max(0, Math.round(idleMs));
        entry.status = entry.activityPercent < 25 ? 'inactive' : 'active';
        entry.updatedAt = now();
        this.scheduleSave();
        return entry;
    }
    addUsage(entryId, userId, appName, windowTitle, role) {
        const entry = this.getOwnedEntry(entryId, userId, role);
        const arr = this.store.usage[entry.id] || [];
        arr.push({ id: (0, nanoid_1.nanoid)(10), userId: entry.userId, appName, windowTitle, capturedAt: now() });
        this.store.usage[entry.id] = arr.slice(-MAX_USAGE_PER_ENTRY);
        this.scheduleSave();
        return { ok: true };
    }
    listUsage(entryId) {
        return this.store.usage[entryId] || [];
    }
    async addScreenshot(entryId, userId, imageBase64, role) {
        const entry = this.getOwnedEntry(entryId, userId, role);
        const data = (imageBase64 || '').replace(/^data:image\/\w+;base64,/, '');
        if (!data)
            throw new common_1.BadRequestException('empty_image');
        const fileName = `${entry.id}-${Date.now()}.jpg`;
        await fs_1.promises.mkdir(SCREENSHOT_DIR, { recursive: true });
        await fs_1.promises.writeFile(path.join(SCREENSHOT_DIR, fileName), Buffer.from(data, 'base64'));
        const rec = {
            id: (0, nanoid_1.nanoid)(10),
            userId: entry.userId,
            capturedAt: now(),
            path: `/screenshots/${fileName}`,
        };
        const arr = this.store.screenshots[entry.id] || [];
        arr.push(rec);
        this.store.screenshots[entry.id] = arr;
        this.scheduleSave();
        return rec;
    }
    listScreenshots(entryId) {
        return this.store.screenshots[entryId] || [];
    }
    getSettings(userId) {
        return this.store.settings[userId] || { screenshotIntervalMinutes: 10, allowMonitoring: true };
    }
    updateSettings(userId, settings) {
        this.store.settings[userId] = settings;
        this.scheduleSave();
        return settings;
    }
    /** Worked ms today for a user: entries are clipped to local midnight. */
    msToday(userId, ref = new Date()) {
        const dayStart = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()).getTime();
        const nowMs = ref.getTime();
        let total = 0;
        for (const e of this.store.entries) {
            if (e.userId !== userId)
                continue;
            const start = Math.max(new Date(e.startTime).getTime(), dayStart);
            const end = e.endTime ? new Date(e.endTime).getTime() : nowMs;
            if (end > start)
                total += end - start;
        }
        return total;
    }
    daySummary(userId) {
        const active = this.getActiveEntry(userId);
        return {
            msToday: this.msToday(userId),
            tracking: !!active,
            activeEntry: active,
            activityPercent: active ? active.activityPercent : null,
        };
    }
    /** All screenshots for a user across today's entries, newest first. */
    userScreenshots(userId, limit = 60) {
        const out = [];
        for (const entry of this.store.entries) {
            if (entry.userId !== userId)
                continue;
            for (const s of this.store.screenshots[entry.id] || [])
                out.push(s);
        }
        out.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
        return out.slice(0, limit);
    }
    teamSummary(onlineIds) {
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
                lastScreenshot: lastShot ? lastShot.path : null,
                activeEntryId: active ? active.id : null,
            };
        });
    }
};
exports.TimeTrackingService = TimeTrackingService;
exports.TimeTrackingService = TimeTrackingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService])
], TimeTrackingService);
//# sourceMappingURL=time-tracking.service.js.map