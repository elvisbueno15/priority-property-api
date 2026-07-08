import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './guards/roles.guard';
import { Role } from '../users/entities/role.enum';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: { email: string; password: string; name: string; role?: Role }) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: { email: string; password: string }) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @Post('promote')
  promote(@Body() dto: { userId: string; role: Role }) {
    return this.authService.promote(dto.userId, dto.role);
  }
}
