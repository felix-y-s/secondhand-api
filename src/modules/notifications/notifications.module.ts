import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './repositories/notifications.repository';
import { NotificationController } from './notifications.controller';

@Module({
  providers:[NotificationsService, NotificationsRepository],
  controllers: [NotificationController]
})
export class NotificationModule {}