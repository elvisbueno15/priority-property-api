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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeetingsController = void 0;
const common_1 = require("@nestjs/common");
const meetings_service_1 = require("./meetings.service");
const presence_service_1 = require("../users/presence.service");
const users_service_1 = require("../users/users.service");
const activity_service_1 = require("../activity/activity.service");
const events_service_1 = require("../events/events.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const role_enum_1 = require("../users/entities/role.enum");
let MeetingsController = class MeetingsController {
    constructor(meetings, presence, usersService, activity, events) {
        this.meetings = meetings;
        this.presence = presence;
        this.usersService = usersService;
        this.activity = activity;
        this.events = events;
    }
    list(req) {
        this.presence.touch(req.user.sub);
        return this.meetings.listUpcoming();
    }
    create(req, body) {
        const meeting = this.meetings.create(req.user, body);
        const others = this.usersService.listPublic().filter((u) => u.id !== req.user.sub).map((u) => u.id);
        const when = new Date(meeting.startsAt).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
        this.activity.pushMany(others, 'meeting', `New meeting scheduled: ${meeting.title} — ${when}`);
        this.events.emitAll('meeting', {});
        return meeting;
    }
    remove(req, id) {
        const out = this.meetings.remove(id, req.user);
        this.events.emitAll('meeting', {});
        return out;
    }
    ping(req, id) {
        this.presence.touch(req.user.sub);
        return this.meetings.ping(id, req.user.sub);
    }
    leave(req, id) {
        return this.meetings.leave(id, req.user.sub);
    }
    signal(req, id, body) {
        return this.meetings.sendSignal(id, req.user, body.to, body.type, body.data);
    }
    signals(req, id) {
        this.presence.touch(req.user.sub);
        return this.meetings.drainSignals(id, req.user.sub);
    }
    room(id) {
        return this.meetings.room(id);
    }
};
exports.MeetingsController = MeetingsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MeetingsController.prototype, "list", null);
__decorate([
    (0, roles_guard_1.Roles)(role_enum_1.Role.OWNER, role_enum_1.Role.ADMIN),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], MeetingsController.prototype, "create", null);
__decorate([
    (0, roles_guard_1.Roles)(role_enum_1.Role.OWNER, role_enum_1.Role.ADMIN),
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MeetingsController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/ping'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MeetingsController.prototype, "ping", null);
__decorate([
    (0, common_1.Post)(':id/leave'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MeetingsController.prototype, "leave", null);
__decorate([
    (0, common_1.Post)(':id/signal'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], MeetingsController.prototype, "signal", null);
__decorate([
    (0, common_1.Get)(':id/signals'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MeetingsController.prototype, "signals", null);
__decorate([
    (0, common_1.Get)(':id/room'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MeetingsController.prototype, "room", null);
exports.MeetingsController = MeetingsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('meetings'),
    __metadata("design:paramtypes", [meetings_service_1.MeetingsService,
        presence_service_1.PresenceService,
        users_service_1.UsersService,
        activity_service_1.ActivityService,
        events_service_1.EventsService])
], MeetingsController);
//# sourceMappingURL=meetings.controller.js.map