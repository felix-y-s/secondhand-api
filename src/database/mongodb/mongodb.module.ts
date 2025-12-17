import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import {
  ProductDetail,
  ProductDetailSchema,
} from './schemas/product-detail.schema';
import {
  Message,
  MessageSchema,
  ChatRoom,
  ChatRoomSchema,
} from '@/modules/messages-mongo/schemas';
import { MongodbService } from './mongodb.service';

/**
 * MongoDB 연결 및 스키마 관리 모듈
 * - ProductDetail: 상품 상세 정보 (이미지, 위치, 메타데이터)
 * - Message: 실시간 채팅 메시지
 */
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('database.mongodb.uri'),
      }),
    }),
    MongooseModule.forFeature([
      { name: ProductDetail.name, schema: ProductDetailSchema },
      { name: Message.name, schema: MessageSchema },
      { name: ChatRoom.name, schema: ChatRoomSchema},
    ]),
  ],
  providers: [MongodbService],
  exports: [MongooseModule, MongodbService],
})
export class MongodbModule {}
