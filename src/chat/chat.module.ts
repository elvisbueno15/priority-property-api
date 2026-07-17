import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { UsersModule } from '../users/users.module';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [UsersModule, ActivityModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
