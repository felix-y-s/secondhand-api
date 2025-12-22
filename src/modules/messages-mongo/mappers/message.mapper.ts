import { Injectable } from '@nestjs/common';
import { MessageEntity } from '../domain/entities/message.entity';

@Injectable()
export class MessageMapper {
  toEntity(doc: any): MessageEntity {
    return {
      id: doc._id.toString(),
      conversationId: doc.conversationId,
      senderId: doc.senderId,
      receiverId: doc.receiverId,
      message: doc.message,
      messageType: doc.messageType,
      readAt: doc.readAt || null,
      fileUrl: doc.fileUrl,
      fileName: doc.fileName,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  toEntityOrNull(doc: any): MessageEntity | null {
    if (!doc) return null;

    return this.toEntity(doc);
  }

  toEntities(docs: any[]): MessageEntity[] {
    return docs
      .map((doc) => this.toEntity(doc))
      .filter(Boolean) as MessageEntity[];
  }
}
