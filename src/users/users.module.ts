import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PresenceService } from './presence.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, PresenceService],
  exports: [UsersService, PresenceService],
})
export class UsersModule {}
