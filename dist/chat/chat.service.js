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
exports.ChatService = exports.CHANNELS = void 0;
exports.isDmChannel = isDmChannel;
exports.dmParticipants = dmParticipants;
const common_1 = require("@nestjs/common");
const nanoid_1 = require("nanoid");
const fs_1 = require("fs");
const fsSync = __importStar(require("fs"));
const path = __importStar(require("path"));
const data_dir_util_1 = require("../data-dir.util");
const STORE_PATH = path.join(data_dir_util_1.DATA_DIR, 'chat.json');
const ATTACH_PATH = path.join(data_dir_util_1.DATA_DIR, 'attachments.json');
const MAX_PER_CHANNEL = 2000;
const PAGE_SIZE = 100;
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB per file
const MAX_TOTAL_BYTES = 60 * 1024 * 1024; // keep the attachment store bounded
const ALLOWED_MIME = /^(image\/(png|jpe?g|gif|webp|bmp)|application\/pdf|text\/plain|application\/(msword|vnd\.openxmlformats-officedocument\.\w+|vnd\.ms-excel|zip)|audio\/\w+|video\/\w+)$/i;
exports.CHANNELS = ['general', 'support', 'executives'];
/**
 * Direct-message channels look like `dm:<idA>:<idB>` with the two user ids
 * sorted, so both sides always compute the same channel name.
 */
function isDmChannel(channel) {
    return channel.startsWith('dm:') && channel.split(':').length === 3;
}
function dmParticipants(channel) {
    return channel.split(':').slice(1);
}
let ChatService = class ChatService {
    constructor() {
        this.messages = [];
        this.attachments = [];
        this.saveTimer = null;
        this.attachTimer = null;
        try {
            const parsed = JSON.parse(fsSync.readFileSync(STORE_PATH, 'utf-8'));
            this.messages = parsed.messages || [];
        }
        catch {
            this.messages = [];
        }
        try {
            const parsed = JSON.parse(fsSync.readFileSync(ATTACH_PATH, 'utf-8'));
            this.attachments = parsed.attachments || [];
        }
        catch {
            this.attachments = [];
        }
    }
    scheduleSave() {
        if (this.saveTimer)
            return;
        this.saveTimer = setTimeout(async () => {
            this.saveTimer = null;
            try {
                await fs_1.promises.mkdir(data_dir_util_1.DATA_DIR, { recursive: true });
                await fs_1.promises.writeFile(STORE_PATH, JSON.stringify({ messages: this.messages }, null, 2), 'utf-8');
            }
            catch (e) {
                console.error('chat store save failed', e);
            }
        }, 400);
    }
    scheduleAttachSave() {
        if (this.attachTimer)
            return;
        this.attachTimer = setTimeout(async () => {
            this.attachTimer = null;
            try {
                await fs_1.promises.mkdir(data_dir_util_1.DATA_DIR, { recursive: true });
                await fs_1.promises.writeFile(ATTACH_PATH, JSON.stringify({ attachments: this.attachments }, null, 2), 'utf-8');
            }
            catch (e) {
                console.error('attachment store save failed', e);
            }
        }, 400);
    }
    /** Store an uploaded file (base64) and return its public metadata. */
    saveAttachment(by, name, mime, dataUrlOrB64) {
        const clean = String(dataUrlOrB64 || '').replace(/^data:[^,]*;base64,/, '');
        if (!clean)
            throw new common_1.BadRequestException('empty_file');
        if (!ALLOWED_MIME.test(mime || ''))
            throw new common_1.BadRequestException('unsupported_file_type');
        const size = Math.floor((clean.length * 3) / 4);
        if (size > MAX_FILE_BYTES)
            throw new common_1.BadRequestException('file_too_large');
        const rec = {
            id: (0, nanoid_1.nanoid)(14),
            name: (name || 'file').slice(0, 200),
            mime,
            size,
            data: clean,
            by,
            at: new Date().toISOString(),
        };
        this.attachments.push(rec);
        // Bound the store: drop oldest until under the total budget.
        let total = this.attachments.reduce((s, a) => s + a.size, 0);
        while (total > MAX_TOTAL_BYTES && this.attachments.length > 1) {
            const dropped = this.attachments.shift();
            total -= dropped ? dropped.size : 0;
        }
        this.scheduleAttachSave();
        return { id: rec.id, name: rec.name, mime: rec.mime, size: rec.size };
    }
    getAttachment(id) {
        return this.attachments.find((a) => a.id === id);
    }
    channels() {
        return exports.CHANNELS;
    }
    /** Public channels are open to everyone; a DM only to its two participants. */
    assertAccess(channel, userId) {
        if (exports.CHANNELS.includes(channel))
            return;
        if (isDmChannel(channel) && dmParticipants(channel).includes(userId))
            return;
        throw new common_1.BadRequestException('unknown_channel');
    }
    list(channel, userId, afterId) {
        this.assertAccess(channel, userId);
        const inChannel = this.messages.filter((m) => m.channel === channel);
        if (afterId) {
            const idx = inChannel.findIndex((m) => m.id === afterId);
            if (idx >= 0)
                return inChannel.slice(idx + 1);
        }
        return inChannel.slice(-PAGE_SIZE);
    }
    clear(channel, user) {
        if (exports.CHANNELS.includes(channel)) {
            if (user.role !== 'owner' && user.role !== 'admin')
                throw new common_1.BadRequestException('admin_required');
        }
        else {
            this.assertAccess(channel, user.sub);
        }
        this.messages = this.messages.filter((m) => m.channel !== channel);
        this.scheduleSave();
        return { ok: true };
    }
    post(user, name, channel, body, attachment) {
        this.assertAccess(channel, user.sub);
        const text = (body || '').trim();
        if (!text && !attachment)
            throw new common_1.BadRequestException('empty_message');
        const msg = {
            id: (0, nanoid_1.nanoid)(12),
            channel,
            userId: user.sub,
            name,
            body: text.slice(0, 4000),
            at: new Date().toISOString(),
            ...(attachment ? { attachment } : {}),
        };
        this.messages.push(msg);
        const inChannel = this.messages.filter((m) => m.channel === channel);
        if (inChannel.length > MAX_PER_CHANNEL) {
            const dropId = inChannel[0].id;
            this.messages = this.messages.filter((m) => m.id !== dropId);
        }
        this.scheduleSave();
        return msg;
    }
};
exports.ChatService = ChatService;
exports.ChatService = ChatService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], ChatService);
//# sourceMappingURL=chat.service.js.map