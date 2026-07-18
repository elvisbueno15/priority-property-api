import { Module } from '@nestjs/common';
import { ChatController, ChatAttachmentController } from './chat.controller';
import { ChatService } from './chat.service';
import { UsersModule } from '../users/users.module';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [UsersModule, ActivityModule],
  controllers: [ChatController, ChatAttachmentController],
  providers: [ChatService],
})
export class ChatModule {}
