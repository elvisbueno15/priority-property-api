import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomInt } from 'crypto';
import { UsersService } from '../users/users.service';
import { sendResetCodeEmail } from '../email';
import * as bcrypt from 'bcryptjs';
import { Role } from '../users/entities/role.enum';

const RESET_CODE_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  // email (lowercased) -> { code, expires }. In-memory on purpose: codes are
  // short-lived, so a restart just means the user requests a fresh one.
  private resetCodes = new Map<string, { code: string; expires: number }>();

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: { email: string; password: string; name: string; role?: Role }) {
    const existing = this.usersService.findByEmail(dto.email);
    if (existing) throw new UnauthorizedException('Email already registered');
    const user = await this.usersService.create(dto.email, dto.password, dto.name, dto.role || Role.EMPLOYEE);
    const accessToken = await this.jwtService.signAsync({ sub: user.id, email: user.email, role: user.role });
    return { accessToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
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
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      this.resetCodes.set(user.email.toLowerCase(), { code, expires: Date.now() + RESET_CODE_TTL_MS });
      await sendResetCodeEmail(user.email, code);
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
    if (!entry || entry.expires < Date.now() || entry.code !== (code || '').trim()) {
      throw new UnauthorizedException('Invalid or expired code.');
    }
    const user = this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid or expired code.');
    await this.usersService.setPassword(user.id, newPassword);
    this.resetCodes.delete(key);
    return { ok: true };
  }
}
