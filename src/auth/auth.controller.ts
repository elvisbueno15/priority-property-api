import { Controller, Post, Body, Request, UseGuards, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './guards/roles.guard';
import { Role } from '../users/entities/role.enum';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  register(@Body() dto: { email: string; password: string; name: string; role?: Role }) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: { email: string; password: string }) {
    return this.authService.login(dto);
  }

  /** Signed-in user changes their own password (e.g. after a temp reset). */
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(@Request() req: any, @Body() dto: { currentPassword: string; newPassword: string }) {
    if (!dto.newPassword || dto.newPassword.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters.');
    }
    const ok = await this.usersService.verifyPassword(req.user.sub, dto.currentPassword || '');
    if (!ok) throw new UnauthorizedException('Current password is wrong.');
    await this.usersService.setPassword(req.user.sub, dto.newPassword);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @Post('promote')
  promote(@Body() dto: { userId: string; role: Role }) {
    return this.authService.promote(dto.userId, dto.role);
  }
}
