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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = __importStar(require("bcryptjs"));
const crypto_1 = require("crypto");
const role_enum_1 = require("./entities/role.enum");
const fs_1 = require("fs");
const path = __importStar(require("path"));
const data_dir_util_1 = require("../data-dir.util");
let UsersService = class UsersService {
    constructor() {
        this.filePath = path.join(data_dir_util_1.DATA_DIR, 'users.json');
        this.users = [];
        this.ready = this.load();
    }
    async load() {
        try {
            const raw = await fs_1.promises.readFile(this.filePath, 'utf-8');
            this.users = JSON.parse(raw);
        }
        catch {
            this.users = [];
            await this.save();
        }
        await this.seedIfMissing();
    }
    async save() {
        const dir = path.dirname(this.filePath);
        await fs_1.promises.mkdir(dir, { recursive: true });
        await fs_1.promises.writeFile(this.filePath, JSON.stringify(this.users, null, 2), 'utf-8');
    }
    findByEmail(email) {
        return this.users.find(u => u.email === email);
    }
    findById(id) {
        return this.users.find(u => u.id === id);
    }
    async findAll() {
        return this.users.slice();
    }
    async create(email, password, name, role = role_enum_1.Role.EMPLOYEE) {
        if (this.findByEmail(email)) {
            throw new Error('Email already registered');
        }
        const user = {
            id: (0, crypto_1.randomUUID)(),
            email,
            passwordHash: await bcrypt.hash(password, 10),
            name,
            role,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        this.users.push(user);
        await this.save();
        return user;
    }
    async promote(userId, role) {
        const user = this.findById(userId);
        if (!user)
            throw new Error('User not found');
        user.role = role;
        user.updatedAt = new Date().toISOString();
        await this.save();
        return user;
    }
    async remove(userId) {
        this.users = this.users.filter(u => u.id !== userId);
        await this.save();
    }
    listPublic() {
        return this.users.map(({ id, email, name, role }) => ({ id, email, name, role }));
    }
    async seedIfMissing() {
        const demo = [
            ['owner@demo.com', 'owner123', 'Owner Demo', role_enum_1.Role.OWNER],
            ['admin@demo.com', 'admin123', 'Admin Demo', role_enum_1.Role.ADMIN],
            ['employee@demo.com', 'employee123', 'Employee Demo', role_enum_1.Role.EMPLOYEE],
        ];
        let added = false;
        for (const [email, password, name, role] of demo) {
            if (this.findByEmail(email))
                continue;
            await this.create(email, password, name, role);
            added = true;
        }
        return added;
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], UsersService);
//# sourceMappingURL=users.service.js.map