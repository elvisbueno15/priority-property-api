import { Controller, Get, Post, Delete, Body, Param, Request, UseGuards } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { Role } from '../users/entities/role.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('feedback')
export class FeedbackController {
  constructor(
    private readonly feedback: FeedbackService,
    private readonly usersService: UsersService,
  ) {}

  @Post()
  submit(@Request() req: any, @Body() body: { category: string; message: string }) {
    const user = this.usersService.findById(req.user.sub);
    return this.feedback.submit(
      { id: req.user.sub, name: user ? user.name : '', email: user ? user.email : req.user.email },
      body.category,
      body.message,
    );
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Get()
  list() {
    return this.feedback.list();
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.feedback.remove(id);
  }
}
