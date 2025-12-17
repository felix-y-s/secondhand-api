import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * 채팅 메시지 스키마
 * 실시간 채팅 메시지를 MongoDB에 저장
 * - 대화방별 메시지 그룹화
 * - 발신자/수신자 정보
 * - 메시지 타입 (텍스트/이미지/시스템)
 * - 읽음 상태
 *
 * @remarks
 * timestamps: true 옵션으로 자동 생성되는 필드:
 * - createdAt: 메시지 발신 시간
 * - updatedAt: 메시지 수정 시간
 */
@Schema({ collection: 'messages', timestamps: true })
export class Message extends Document {
  // 대화방 ID (senderId-receiverId 조합)
  @Prop({ required: true })
  conversationId: string;

  // 발신자 ID (PostgreSQL의 User ID)
  @Prop({ required: true })
  senderId: string;

  // 수신자 ID (PostgreSQL의 User ID)
  @Prop({ required: true })
  receiverId: string;

  // 메시지 내용
  @Prop({ required: true })
  message: string;

  // 메시지 타입
  @Prop({ enum: ['TEXT', 'IMAGE', 'SYSTEM'], default: 'TEXT' })
  messageType: string;

  // 읽음 시간
  @Prop()
  readAt?: Date;

  @Prop()
  fileUrl?: string;

  @Prop()
  fileName?: string;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// 인덱스 설정
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1 });
MessageSchema.index({ receiverId: 1 });
MessageSchema.index({ readAt: 1 });
