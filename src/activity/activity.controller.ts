import { Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('activity')
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  list(@Request() req: any) {
    return { items: this.activity.list(req.user.sub), unread: this.activity.unreadCount(req.user.sub) };
  }

  @Post('read')
  read(@Request() req: any) {
    return this.activity.markAllRead(req.user.sub);
  }
}
