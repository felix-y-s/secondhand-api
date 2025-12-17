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

@Module({
  imports: [MongodbModule, UsersModule, ProductsModule],
  controllers: [MessagesMongoController],
  providers: [MessagesMongoService, MessageRepositoryMongo, ChatRoomRepositoryMongo, MessageService, ChatRoomService, MessageMapper, ChatRoomMapper],
})
export class MessagesMongoModule {}