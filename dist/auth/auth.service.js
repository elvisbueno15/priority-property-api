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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const crypto_1 = require("crypto");
const users_service_1 = require("../users/users.service");
const email_1 = require("../email");
const bcrypt = __importStar(require("bcryptjs"));
const role_enum_1 = require("../users/entities/role.enum");
const RESET_CODE_TTL_MS = 15 * 60 * 1000;
// A 6-digit code has 1M combos; capping wrong guesses per code (combined with
// the 60s email cooldown) keeps brute force infeasible.
const MAX_RESET_ATTEMPTS = 5;
let AuthService = class AuthService {
    constructor(usersService, jwtService) {
        this.usersService = usersService;
        this.jwtService = jwtService;
        // email (lowercased) -> { code, expires, attempts }. In-memory on purpose:
        // codes are short-lived, so a restart just means the user requests a fresh one.
        this.resetCodes = new Map();
        // Cooldown so nobody can flood a teammate's inbox via /auth/forgot-password.
        this.lastResetEmailAt = new Map();
    }
    async register(dto) {
        const existing = this.usersService.findByEmail(dto.email);
        if (existing)
            throw new common_1.UnauthorizedException('Email already registered');
        const user = await this.usersService.create(dto.email, dto.password, dto.name, dto.role || role_enum_1.Role.EMPLOYEE);
        const accessToken = await this.jwtService.signAsync({ sub: user.id, email: user.email, role: user.role });
        return { accessToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
    }
    async login(dto) {
        const user = this.usersService.findByEmail(dto.email);
        if (!user)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const valid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!valid)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const accessToken = await this.jwtService.signAsync({ sub: user.id, email: user.email, role: user.role });
        return {
            accessToken,
            user: { id: user.id, email: user.email, name: user.name, role: user.role },
        };
    }
    async promote(userId, role) {
        return this.usersService.promote(userId, role);
    }
    /**
     * Start a "forgot password" flow: e-mail a 6-digit code to the address if it
     * belongs to a real account. Always resolves the same way so callers can't
     * probe which emails are registered.
     */
    async requestPasswordReset(email) {
        const clean = (email || '').trim();
        const user = this.usersService.findByEmail(clean);
        if (user) {
            const key = user.email.toLowerCase();
            // Same "ok" answer during the cooldown — silent, so it leaks nothing.
            if (Date.now() - (this.lastResetEmailAt.get(key) || 0) < 60_000)
                return { ok: true };
            this.lastResetEmailAt.set(key, Date.now());
            const code = String((0, crypto_1.randomInt)(0, 1_000_000)).padStart(6, '0');
            this.resetCodes.set(key, { code, expires: Date.now() + RESET_CODE_TTL_MS, attempts: 0 });
            // Fire-and-forget: don't await, so a real account (which triggers a live
            // Resend call) can't be told apart from an unknown one by response timing.
            void (0, email_1.sendResetCodeEmail)(user.email, code);
        }
        return { ok: true };
    }
    /** Finish the flow: verify the code and set the new password. */
    async resetPassword(email, code, newPassword) {
        if (!newPassword || newPassword.length < 6) {
            throw new common_1.BadRequestException('Password must be at least 6 characters.');
        }
        const key = (email || '').trim().toLowerCase();
        const entry = this.resetCodes.get(key);
        if (!entry || entry.expires < Date.now()) {
            throw new common_1.UnauthorizedException('Invalid or expired code.');
        }
        if (entry.code !== (code || '').trim()) {
            // Burn the code after too many wrong guesses so it can't be brute-forced;
            // the attacker then has to request a new one (rate-limited to 1/min).
            if (++entry.attempts >= MAX_RESET_ATTEMPTS)
                this.resetCodes.delete(key);
            throw new common_1.UnauthorizedException('Invalid or expired code.');
        }
        const user = this.usersService.findByEmail(email);
        if (!user)
            throw new common_1.UnauthorizedException('Invalid or expired code.');
        await this.usersService.setPassword(user.id, newPassword);
        this.resetCodes.delete(key);
        return { ok: true };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map