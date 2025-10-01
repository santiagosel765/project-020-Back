import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [ NotificationService ]
})
export class NotificationModule {}
