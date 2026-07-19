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
exports.ChatAttachmentController = exports.ChatController = void 0;
const common_1 = require("@nestjs/common");
const chat_service_1 = require("./chat.service");
const presence_service_1 = require("../users/presence.service");
const users_service_1 = require("../users/users.service");
const activity_service_1 = require("../activity/activity.service");
const events_service_1 = require("../events/events.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let ChatController = class ChatController {
    constructor(chat, presence, usersService, activity, events) {
        this.chat = chat;
        this.presence = presence;
        this.usersService = usersService;
        this.activity = activity;
        this.events = events;
    }
    channels() {
        return this.chat.channels();
    }
    messages(req, channel = 'general', after) {
        this.presence.touch(req.user.sub);
        return this.chat.list(channel, req.user.sub, after);
    }
    clear(req, channel = 'general') {
        return this.chat.clear(channel, req.user);
    }
    /** Upload a file (base64) to attach to a message; returns its metadata. */
    upload(req, body) {
        return this.chat.saveAttachment(req.user.sub, body.name, body.mime, body.data);
    }
    post(req, body) {
        this.presence.touch(req.user.sub);
        const user = this.usersService.findById(req.user.sub);
        const name = user ? user.name : req.user.email;
        const channel = body.channel || 'general';
        const msg = this.chat.post(req.user, name, channel, body.body, body.attachment);
        this.notify(req.user.sub, name, channel, msg.body || (msg.attachment ? '📎 ' + msg.attachment.name : ''));
        // Realtime push so open chats refresh instantly (polling stays as fallback).
        // Include sender + a short preview so clients can raise a notification/sound.
        const preview = msg.body ? msg.body.slice(0, 120) : (msg.attachment ? '📎 ' + msg.attachment.name : '');
        const payload = { channel, byId: req.user.sub, byName: name, preview };
        if ((0, chat_service_1.isDmChannel)(channel)) {
            for (const id of (0, chat_service_1.dmParticipants)(channel))
                this.events.emitToUser(id, 'chat', payload);
        }
        else {
            this.events.emitAll('chat', payload);
        }
        return msg;
    }
    /** Fan out activity: DM recipient, plus anyone @mentioned by name. */
    notify(senderId, senderName, channel, text) {
        if ((0, chat_service_1.isDmChannel)(channel)) {
            const other = (0, chat_service_1.dmParticipants)(channel).find((id) => id !== senderId);
            if (other)
                this.activity.push(other, 'dm', `${senderName} sent you a private message`);
            return;
        }
        if (!text.includes('@'))
            return;
        const lower = text.toLowerCase();
        for (const u of this.usersService.listPublic()) {
            if (u.id === senderId)
                continue;
            const first = u.name.split(' ')[0].toLowerCase();
            if (lower.includes('@' + u.name.toLowerCase()) || lower.includes('@' + first)) {
                this.activity.push(u.id, 'mention', `${senderName} mentioned you in #${channel}`);
            }
        }
    }
};
exports.ChatController = ChatController;
__decorate([
    (0, common_1.Get)('channels'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ChatController.prototype, "channels", null);
__decorate([
    (0, common_1.Get)('messages'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('channel')),
    __param(2, (0, common_1.Query)('after')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", void 0)
], ChatController.prototype, "messages", null);
__decorate([
    (0, common_1.Delete)('messages'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('channel')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ChatController.prototype, "clear", null);
__decorate([
    (0, common_1.Post)('upload'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ChatController.prototype, "upload", null);
__decorate([
    (0, common_1.Post)('messages'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ChatController.prototype, "post", null);
exports.ChatController = ChatController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('chat'),
    __metadata("design:paramtypes", [chat_service_1.ChatService,
        presence_service_1.PresenceService,
        users_service_1.UsersService,
        activity_service_1.ActivityService,
        events_service_1.EventsService])
], ChatController);
/**
 * Serves attachment bytes. Public on purpose: <img> / download links can't send
 * the JWT header, and ids are unguessable (nanoid). Same model as /screenshots.
 */
let ChatAttachmentController = class ChatAttachmentController {
    constructor(chat) {
        this.chat = chat;
    }
    attachment(id, res) {
        const a = this.chat.getAttachment(id);
        if (!a)
            throw new common_1.NotFoundException('not_found');
        res.setHeader('Content-Type', a.mime || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(a.name)}"`);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.end(Buffer.from(a.data, 'base64'));
    }
};
exports.ChatAttachmentController = ChatAttachmentController;
__decorate([
    (0, common_1.Get)('attachment/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ChatAttachmentController.prototype, "attachment", null);
exports.ChatAttachmentController = ChatAttachmentController = __decorate([
    (0, common_1.Controller)('chat'),
    __metadata("design:paramtypes", [chat_service_1.ChatService])
], ChatAttachmentController);
//# sourceMappingURL=chat.controller.js.map