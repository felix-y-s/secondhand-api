import { Injectable } from '@nestjs/common';
import { ChatRoomEntity } from '../domain/entities/chat-room.entity';

@Injectable()
export class ChatRoomMapper {
  toEntity(doc: any): ChatRoomEntity {
    const participants = doc.participants.map((par: any) => ({
      userId: par.userId,
      joinedAt: par.joinedAt,
      leftAt: par.leftAt,
    }));
    return {
      id: doc._id.toString(),
      productId: doc.productId,
      participants,
      participantsCount: doc.participantsCount,
      lastMessage: doc.lastMessage,
      lastMessageId: doc.lastMessageId,
      lastMessageAt: doc.lastMessageAt,
      relatedOrderId: doc.relatedOrderId,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  toEntityOrNull(doc: any): ChatRoomEntity | null {
    if (!doc) return null;

    return this.toEntity(doc);
  }

  toEntities(docs: any[]): ChatRoomEntity[] {
    return docs
      .map((doc) => this.toEntity(doc))
      .filter(Boolean) as ChatRoomEntity[];
  }
}
