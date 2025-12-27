import { Module } from '@nestjs/common';
import { MessagesMongoController } from './messages-mongo.controller';
import { MessageRepositoryMongo } from './repositories/messages.repository.mongo';
import { MongodbModule } from '@/database/mongodb/mongodb.module';
import { MessagesMongoService } from './messages-mongo.service';
import { MessageService } from './services/message.service';
import { ChatRoomService } from './services/chat-room.service';
import { ChatRoomRepositoryMongo } from './repositories/chat-room.repository.mongo';
import { UsersModule } from '@/modules/users/users.module';
import { ProductsModule } from '../products/products.module';
import { MessageMapper } from './mappers/message.mapper';
import { ChatRoomMapper } from './mappers/chat-room.mapper';
import { EventsModule } from '@/events/events.module';
import { UpdateLastMessageHandler } from './events/handlers/update-last-message.handler';
import { SendMessageNotificationHandler } from './events/handlers/send-message-notification.handler';
import { UpdateUnreadCountHandler } from './events/handlers/update-unread-count.handler';
import { UpdateMessageStatisticsHandler } from './events/handlers/update-message-statistics.handler';

@Module({
  imports: [MongodbModule, UsersModule, ProductsModule, EventsModule],
  controllers: [MessagesMongoController],
  providers: [
    // 서비스
    MessagesMongoService,
    MessageService,
    ChatRoomService,
    // 리포지토리
    MessageRepositoryMongo,
    ChatRoomRepositoryMongo,
    // 매퍼
    MessageMapper,
    ChatRoomMapper,
    // 이벤트 핸들러
    UpdateLastMessageHandler,
    SendMessageNotificationHandler,
    UpdateUnreadCountHandler,
    UpdateMessageStatisticsHandler,
  ],
})
export class MessagesMongoModule {}