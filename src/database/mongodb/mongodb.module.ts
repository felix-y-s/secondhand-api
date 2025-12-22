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
        // 연결 풀 설정 (동시성 테스트 대응)
        maxPoolSize: 20, // 최대 연결 수 (기본값: 10)
        minPoolSize: 5, // 최소 연결 수 (기본값: 0)
        serverSelectionTimeoutMS: 5000, // 서버 선택 타임아웃
        socketTimeoutMS: 45000, // 소켓 타임아웃
        // 연결 에러 핸들링
        retryWrites: true, // 쓰기 실패 시 자동 재시도
        retryReads: true, // 읽기 실패 시 자동 재시도
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
