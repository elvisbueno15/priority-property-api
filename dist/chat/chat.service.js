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
const common_1 = require("@nestjs/common");
const nanoid_1 = require("nanoid");
const fs_1 = require("fs");
const fsSync = __importStar(require("fs"));
const path = __importStar(require("path"));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'chat.json');
const MAX_PER_CHANNEL = 2000;
const PAGE_SIZE = 100;
exports.CHANNELS = ['general', 'support', 'executives'];
let ChatService = class ChatService {
    constructor() {
        this.messages = [];
        this.saveTimer = null;
        try {
            const parsed = JSON.parse(fsSync.readFileSync(STORE_PATH, 'utf-8'));
            this.messages = parsed.messages || [];
        }
        catch {
            this.messages = [];
        }
    }
    scheduleSave() {
        if (this.saveTimer)
            return;
        this.saveTimer = setTimeout(async () => {
            this.saveTimer = null;
            try {
                await fs_1.promises.mkdir(DATA_DIR, { recursive: true });
                await fs_1.promises.writeFile(STORE_PATH, JSON.stringify({ messages: this.messages }, null, 2), 'utf-8');
            }
            catch (e) {
                console.error('chat store save failed', e);
            }
        }, 400);
    }
    channels() {
        return exports.CHANNELS;
    }
    list(channel, afterId) {
        const inChannel = this.messages.filter((m) => m.channel === channel);
        if (afterId) {
            const idx = inChannel.findIndex((m) => m.id === afterId);
            if (idx >= 0)
                return inChannel.slice(idx + 1);
        }
        return inChannel.slice(-PAGE_SIZE);
    }
    post(user, name, channel, body) {
        if (!exports.CHANNELS.includes(channel))
            throw new common_1.BadRequestException('unknown_channel');
        const text = (body || '').trim();
        if (!text)
            throw new common_1.BadRequestException('empty_message');
        const msg = {
            id: (0, nanoid_1.nanoid)(12),
            channel,
            userId: user.sub,
            name,
            body: text.slice(0, 4000),
            at: new Date().toISOString(),
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