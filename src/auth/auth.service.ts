import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { Role } from '../users/entities/role.enum';

@Injectable()
export class AuthService {
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
}
