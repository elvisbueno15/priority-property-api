import { Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { PresenceService } from './presence.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly presence: PresenceService,
  ) {}

  @Get('me')
  me(@Request() req: any) {
    this.presence.touch(req.user.sub);
    const user = this.usersService.findById(req.user.sub);
    if (!user) return null;
    const { id, email, name, role } = user;
    return { id, email, name, role };
  }

  @Post('ping')
  ping(@Request() req: any) {
    this.presence.touch(req.user.sub);
    return { ok: true };
  }

  @Get()
  list(@Request() req: any) {
    this.presence.touch(req.user.sub);
    return this.usersService.listPublic().map((u) => ({
      ...u,
      online: this.presence.isOnline(u.id),
    }));
  }
}
