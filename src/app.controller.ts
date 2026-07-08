import { Controller, Get, UseGuards } from '@nestjs/common';
import { UsersService } from './users/users.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Controller()
export class AppController {
  constructor(private readonly usersService: UsersService) {}

  @Get('health')
  health() {
    return { status: 'ok', now: new Date().toISOString() };
  }
}
