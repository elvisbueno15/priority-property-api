import {
  Controller, Get, Post, Put, Delete, Body, Param, Request, UseGuards,
  BadRequestException, ForbiddenException, NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { PresenceService } from './presence.service';
import { ActivityService } from '../activity/activity.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { Role } from './entities/role.enum';

const ASSIGNABLE_ROLES = [Role.OWNER, Role.ADMIN, Role.EMPLOYEE];

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly presence: PresenceService,
    private readonly activity: ActivityService,
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

  @Roles(Role.OWNER, Role.ADMIN)
  @Put(':id/role')
  async changeRole(@Request() req: any, @Param('id') id: string, @Body() body: { role: Role }) {
    if (!ASSIGNABLE_ROLES.includes(body.role)) throw new BadRequestException('invalid_role');
    const target = this.usersService.findById(id);
    if (!target) throw new NotFoundException('user_not_found');
    if (id === req.user.sub) throw new ForbiddenException('cannot_change_own_role');
    // Only an owner may touch another owner or grant the owner role.
    const isOwner = req.user.role === Role.OWNER;
    if ((target.role === Role.OWNER || body.role === Role.OWNER) && !isOwner) {
      throw new ForbiddenException('owner_required');
    }
    const updated = await this.usersService.promote(id, body.role);
    this.activity.push(id, 'role', `Your role was changed to ${updated.role}`);
    const { id: uid, email, name, role } = updated;
    return { id: uid, email, name, role };
  }

  @Roles(Role.OWNER)
  @Delete(':id')
  async removeUser(@Request() req: any, @Param('id') id: string) {
    if (id === req.user.sub) throw new ForbiddenException('cannot_delete_yourself');
    const target = this.usersService.findById(id);
    if (!target) throw new NotFoundException('user_not_found');
    await this.usersService.remove(id);
    return { ok: true };
  }
}
