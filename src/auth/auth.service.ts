import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomInt } from 'crypto';
import { UsersService } from '../users/users.service';
import { sendResetCodeEmail } from '../email';
import * as bcrypt from 'bcryptjs';
import { Role } from '../users/entities/role.enum';

const RESET_CODE_TTL_MS = 15 * 60 * 1000;
// A 6-digit code has 1M combos; capping wrong guesses per code (combined with
// the 60s email cooldown) keeps brute force infeasible.
const MAX_RESET_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  // email (lowercased) -> { code, expires, attempts }. In-memory on purpose:
  // codes are short-lived, so a restart just means the user requests a fresh one.
  private resetCodes = new Map<string, { code: string; expires: number; attempts: number }>();
  // Cooldown so nobody can flood a teammate's inbox via /auth/forgot-password.
  private lastResetEmailAt = new Map<string, number>();

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Self-service account creation.
   *
   * SIGNUP_MODE controls who may register (default 'open' — today's behavior;
   * flip to 'invite' or 'closed' later to lock the product down without a code
   * change). The client-supplied `role` is IGNORED on purpose: a self-registered
   * account is always EMPLOYEE unless its email is on the OWNER_EMAILS allowlist.
   * Owners are otherwise minted only by an existing owner promoting someone
   * in-app — never by anything a stranger can POST.
   */
  async register(dto: { email: string; password: string; name: string; invite?: string }) {
    const email = (dto.email || '').trim();
    const name = (dto.name || '').trim();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new BadRequestException('A valid email is required.');
    }
    if (!name) throw new BadRequestException('Name is required.');
    if (!dto.password || dto.password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters.');
    }

    const mode = (process.env.SIGNUP_MODE || 'open').trim().toLowerCase();
    if (mode === 'closed') {
      throw new ForbiddenException('Registration is closed. Ask an administrator for an account.');
    }
    if (mode === 'invite') {
      const expected = (process.env.SIGNUP_INVITE_CODE || '').trim();
      if (!expected || (dto.invite || '').trim() !== expected) {
        throw new UnauthorizedException('A valid invite code is required to register.');
      }
    }

    const existing = this.usersService.findByEmail(email);
    if (existing) throw new UnauthorizedException('Email already registered');

    const role = this.isOwnerEmail(email) ? Role.OWNER : Role.EMPLOYEE;
    const user = await this.usersService.create(email, dto.password, name, role);
    const accessToken = await this.jwtService.signAsync({ sub: user.id, email: user.email, role: user.role });
    return { accessToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  }

  /** Emails allowed to become OWNER on registration (comma-separated env). */
  private isOwnerEmail(email: string): boolean {
    const list = (process.env.OWNER_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return list.includes((email || '').trim().toLowerCase());
  }

  async login(dto: { email: string; password: string }) {
    const user = this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    const accessToken = await this.jwtService.signAsync({ sub: user.id, email: user.email, role: user.role });
    return {
      accessToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }

  async promote(userId: string, role: Role) {
    return this.usersService.promote(userId, role);
  }

  /**
   * Start a "forgot password" flow: e-mail a 6-digit code to the address if it
   * belongs to a real account. Always resolves the same way so callers can't
   * probe which emails are registered.
   */
  async requestPasswordReset(email: string) {
    const clean = (email || '').trim();
    const user = this.usersService.findByEmail(clean);
    if (user) {
      const key = user.email.toLowerCase();
      // Same "ok" answer during the cooldown — silent, so it leaks nothing.
      if (Date.now() - (this.lastResetEmailAt.get(key) || 0) < 60_000) return { ok: true };
      this.lastResetEmailAt.set(key, Date.now());
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      this.resetCodes.set(key, { code, expires: Date.now() + RESET_CODE_TTL_MS, attempts: 0 });
      // Fire-and-forget: don't await, so a real account (which triggers a live
      // Resend call) can't be told apart from an unknown one by response timing.
      void sendResetCodeEmail(user.email, code);
    }
    return { ok: true };
  }

  /** Finish the flow: verify the code and set the new password. */
  async resetPassword(email: string, code: string, newPassword: string) {
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters.');
    }
    const key = (email || '').trim().toLowerCase();
    const entry = this.resetCodes.get(key);
    if (!entry || entry.expires < Date.now()) {
      throw new UnauthorizedException('Invalid or expired code.');
    }
    if (entry.code !== (code || '').trim()) {
      // Burn the code after too many wrong guesses so it can't be brute-forced;
      // the attacker then has to request a new one (rate-limited to 1/min).
      if (++entry.attempts >= MAX_RESET_ATTEMPTS) this.resetCodes.delete(key);
      throw new UnauthorizedException('Invalid or expired code.');
    }
    const user = this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid or expired code.');
    await this.usersService.setPassword(user.id, newPassword);
    this.resetCodes.delete(key);
    return { ok: true };
  }
}
