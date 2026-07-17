import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TimeTrackingModule } from './time-tracking/time-tracking.module';
import { ChatModule } from './chat/chat.module';
import { MeetingsModule } from './meetings/meetings.module';
import { FeedbackModule } from './feedback/feedback.module';
import { AppController } from './app.controller';

@Module({
  imports: [UsersModule, AuthModule, TimeTrackingModule, ChatModule, MeetingsModule, FeedbackModule],
  controllers: [AppController],
})
export class AppModule {}
