import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'chat_rooms', timestamps: true })
export class ChatRoom extends Document {
  @Prop()
  productId: string;
  
  @Prop({
    type: [
      {
        userId: { type: String, required: true }, // PostgreSQL User ID
        joinedAt: { type: Date, default: Date.now },
        leftAt: { type: Date, default: null }, // 나간 시간 (null이면 참여 중)
      },
    ],
    _id: false, // 서브독 ID 생성 방지
  })
  participants: { userId: string; joinedAt: Date; leftAt?: Date }[];

  // 참가자 카운트(대화방 조회 시 정확한 매칭을 위해 사용 $all은 모두 존재하는지만 판단)
  @Prop()
  participantsCount: number;

  // 마지막 메시지 내용
  @Prop()
  lastMessage?: string;

  // 마지막 메시지 ID (커서 페이징용)
  @Prop({ type: Types.ObjectId })
  lastMessageId?: Types.ObjectId;

  // 마지막 업데이트 시간 (정렬용)
  @Prop({ index: true })
  lastMessageAt?: Date;

  @Prop({ default: null })
  relatedOrderId?: string; // PostgreSQL Order ID

  createdAt: Date;
  updatedAt: Date;
}

// ChatRoom 클래스(설계도)를 기반으로 Mongoose가 이해할 수 있는 실제 스키마 객체를 생성합니다.
// 내부적으로 @Prop(), @Schema() 데코레이터의 메타데이터를 읽어서 처리합니다.
export const ChatRoomSchema = SchemaFactory.createForClass(ChatRoom);

// 내 대화방 목록 조회 및 정렬 최적화 (Compound Index)
// ESR (Equality, Sort, Range) 규칙 적용:
// 1. Equality: participants.userId, participants.leftAt (필터링)
// 2. Sort: lastMessageAt (정렬)
ChatRoomSchema.index({ 
  productId: 1,
  'participants.userId': 1, 
  'participants.leftAt': 1, 
  lastMessageAt: -1,
});

// 대화방 조회 시 사용
ChatRoomSchema.index({
  productId: 1,
  'participants.userId': 1,
  participantsCount: 1,
});