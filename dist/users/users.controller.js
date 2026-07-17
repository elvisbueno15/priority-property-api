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
exports.UsersController = void 0;
const common_1 = require("@nestjs/common");
const users_service_1 = require("./users.service");
const presence_service_1 = require("./presence.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const role_enum_1 = require("./entities/role.enum");
const ASSIGNABLE_ROLES = [role_enum_1.Role.OWNER, role_enum_1.Role.ADMIN, role_enum_1.Role.EMPLOYEE];
let UsersController = class UsersController {
    constructor(usersService, presence) {
        this.usersService = usersService;
        this.presence = presence;
    }
    me(req) {
        this.presence.touch(req.user.sub);
        const user = this.usersService.findById(req.user.sub);
        if (!user)
            return null;
        const { id, email, name, role } = user;
        return { id, email, name, role };
    }
    ping(req) {
        this.presence.touch(req.user.sub);
        return { ok: true };
    }
    list(req) {
        this.presence.touch(req.user.sub);
        return this.usersService.listPublic().map((u) => ({
            ...u,
            online: this.presence.isOnline(u.id),
        }));
    }
    async changeRole(req, id, body) {
        if (!ASSIGNABLE_ROLES.includes(body.role))
            throw new common_1.BadRequestException('invalid_role');
        const target = this.usersService.findById(id);
        if (!target)
            throw new common_1.NotFoundException('user_not_found');
        if (id === req.user.sub)
            throw new common_1.ForbiddenException('cannot_change_own_role');
        // Only an owner may touch another owner or grant the owner role.
        const isOwner = req.user.role === role_enum_1.Role.OWNER;
        if ((target.role === role_enum_1.Role.OWNER || body.role === role_enum_1.Role.OWNER) && !isOwner) {
            throw new common_1.ForbiddenException('owner_required');
        }
        const updated = await this.usersService.promote(id, body.role);
        const { id: uid, email, name, role } = updated;
        return { id: uid, email, name, role };
    }
    async removeUser(req, id) {
        if (id === req.user.sub)
            throw new common_1.ForbiddenException('cannot_delete_yourself');
        const target = this.usersService.findById(id);
        if (!target)
            throw new common_1.NotFoundException('user_not_found');
        await this.usersService.remove(id);
        return { ok: true };
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "me", null);
__decorate([
    (0, common_1.Post)('ping'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "ping", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "list", null);
__decorate([
    (0, roles_guard_1.Roles)(role_enum_1.Role.OWNER, role_enum_1.Role.ADMIN),
    (0, common_1.Put)(':id/role'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "changeRole", null);
__decorate([
    (0, roles_guard_1.Roles)(role_enum_1.Role.OWNER),
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "removeUser", null);
exports.UsersController = UsersController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('users'),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        presence_service_1.PresenceService])
], UsersController);
//# sourceMappingURL=users.controller.js.map