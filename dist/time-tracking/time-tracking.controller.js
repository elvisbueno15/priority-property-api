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
exports.TimeTrackingController = void 0;
const common_1 = require("@nestjs/common");
const time_tracking_service_1 = require("./time-tracking.service");
const presence_service_1 = require("../users/presence.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const role_enum_1 = require("../users/entities/role.enum");
let TimeTrackingController = class TimeTrackingController {
    constructor(service, presence) {
        this.service = service;
        this.presence = presence;
    }
    start(req, body) {
        this.presence.touch(req.user.sub);
        return this.service.startSession(req.user.sub, body?.projectId || 'general');
    }
    pause(req, body) {
        return this.service.pauseSession(body.entryId, req.user.sub, req.user.role);
    }
    resume(req, body) {
        this.presence.touch(req.user.sub);
        return this.service.resumeSession(body.entryId, req.user.sub, req.user.role);
    }
    stop(req, body) {
        return this.service.stopSession(body.entryId, req.user.sub, req.user.role);
    }
    active(req) {
        this.presence.touch(req.user.sub);
        return this.service.getActiveEntry(req.user.sub);
    }
    summary(req) {
        this.presence.touch(req.user.sub);
        return this.service.daySummary(req.user.sub);
    }
    history(req, from, to) {
        return this.service.listEntries(req.user.sub, from, to);
    }
    activity(req, body) {
        this.presence.touch(req.user.sub);
        return this.service.updateActivity(body.entryId, req.user.sub, body.percent, body.idleMs, req.user.role);
    }
    usage(req, body) {
        return this.service.addUsage(body.entryId, req.user.sub, body.appName || '', body.windowTitle || '', req.user.role);
    }
    listUsage(entryId) {
        return this.service.listUsage(entryId);
    }
    screenshots(req, body) {
        return this.service.addScreenshot(body.entryId, req.user.sub, body.imageBase64, req.user.role);
    }
    listScreenshots(entryId) {
        return this.service.listScreenshots(entryId);
    }
    team() {
        return this.service.teamSummary(this.presence.onlineIds());
    }
    settings(req) {
        return this.service.getSettings(req.user.sub);
    }
    updateSettings(req, body) {
        const current = this.service.getSettings(req.user.sub);
        return this.service.updateSettings(req.user.sub, {
            screenshotIntervalMinutes: body.screenshotIntervalMinutes ?? current.screenshotIntervalMinutes,
            allowMonitoring: body.allowMonitoring ?? current.allowMonitoring,
        });
    }
};
exports.TimeTrackingController = TimeTrackingController;
__decorate([
    (0, common_1.Post)('start'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], TimeTrackingController.prototype, "start", null);
__decorate([
    (0, common_1.Post)('pause'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], TimeTrackingController.prototype, "pause", null);
__decorate([
    (0, common_1.Post)('resume'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], TimeTrackingController.prototype, "resume", null);
__decorate([
    (0, common_1.Post)('stop'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], TimeTrackingController.prototype, "stop", null);
__decorate([
    (0, common_1.Get)('active'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TimeTrackingController.prototype, "active", null);
__decorate([
    (0, common_1.Get)('summary'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TimeTrackingController.prototype, "summary", null);
__decorate([
    (0, common_1.Get)('history'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], TimeTrackingController.prototype, "history", null);
__decorate([
    (0, common_1.Post)('activity'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], TimeTrackingController.prototype, "activity", null);
__decorate([
    (0, common_1.Post)('usage'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], TimeTrackingController.prototype, "usage", null);
__decorate([
    (0, roles_guard_1.Roles)(role_enum_1.Role.OWNER, role_enum_1.Role.ADMIN),
    (0, common_1.Get)('usage/:entryId'),
    __param(0, (0, common_1.Param)('entryId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TimeTrackingController.prototype, "listUsage", null);
__decorate([
    (0, common_1.Post)('screenshots'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], TimeTrackingController.prototype, "screenshots", null);
__decorate([
    (0, roles_guard_1.Roles)(role_enum_1.Role.OWNER, role_enum_1.Role.ADMIN),
    (0, common_1.Get)('screenshots/:entryId'),
    __param(0, (0, common_1.Param)('entryId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TimeTrackingController.prototype, "listScreenshots", null);
__decorate([
    (0, roles_guard_1.Roles)(role_enum_1.Role.OWNER, role_enum_1.Role.ADMIN),
    (0, common_1.Get)('team'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TimeTrackingController.prototype, "team", null);
__decorate([
    (0, common_1.Get)('settings'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TimeTrackingController.prototype, "settings", null);
__decorate([
    (0, common_1.Put)('settings'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], TimeTrackingController.prototype, "updateSettings", null);
exports.TimeTrackingController = TimeTrackingController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('time-tracking'),
    __metadata("design:paramtypes", [time_tracking_service_1.TimeTrackingService,
        presence_service_1.PresenceService])
], TimeTrackingController);
//# sourceMappingURL=time-tracking.controller.js.map