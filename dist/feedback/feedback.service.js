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
exports.FeedbackService = void 0;
const common_1 = require("@nestjs/common");
const nanoid_1 = require("nanoid");
const fs_1 = require("fs");
const fsSync = __importStar(require("fs"));
const path = __importStar(require("path"));
const data_dir_util_1 = require("../data-dir.util");
const STORE_PATH = path.join(data_dir_util_1.DATA_DIR, 'feedback.json');
const CATEGORIES = ['problem', 'suggestion', 'question', 'other'];
const MAX_ITEMS = 500;
let FeedbackService = class FeedbackService {
    constructor() {
        this.items = [];
        this.saveTimer = null;
        try {
            const parsed = JSON.parse(fsSync.readFileSync(STORE_PATH, 'utf-8'));
            this.items = parsed.items || [];
        }
        catch {
            this.items = [];
        }
    }
    scheduleSave() {
        if (this.saveTimer)
            return;
        this.saveTimer = setTimeout(async () => {
            this.saveTimer = null;
            try {
                await fs_1.promises.mkdir(data_dir_util_1.DATA_DIR, { recursive: true });
                await fs_1.promises.writeFile(STORE_PATH, JSON.stringify({ items: this.items }, null, 2), 'utf-8');
            }
            catch (e) {
                console.error('feedback store save failed', e);
            }
        }, 400);
    }
    submit(user, category, message) {
        const text = (message || '').trim();
        if (!text)
            throw new common_1.BadRequestException('empty_message');
        const item = {
            id: (0, nanoid_1.nanoid)(10),
            userId: user.id,
            name: user.name,
            email: user.email,
            category: CATEGORIES.includes(category) ? category : 'other',
            message: text.slice(0, 4000),
            at: new Date().toISOString(),
        };
        this.items.push(item);
        this.items = this.items.slice(-MAX_ITEMS);
        this.scheduleSave();
        return item;
    }
    list() {
        return [...this.items].reverse();
    }
    remove(id) {
        const before = this.items.length;
        this.items = this.items.filter((i) => i.id !== id);
        if (this.items.length === before)
            throw new common_1.NotFoundException('feedback_not_found');
        this.scheduleSave();
        return { ok: true };
    }
};
exports.FeedbackService = FeedbackService;
exports.FeedbackService = FeedbackService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], FeedbackService);
//# sourceMappingURL=feedback.service.js.map