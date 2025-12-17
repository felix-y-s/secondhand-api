import {
  PaginatedResult,
  PaginationOptions,
} from '@/common/types';
import { PaginationUtil } from '@/common/utils';
import { Message } from '../schemas';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { MessageType } from '../domain/enums/message-type.enum';
import { ClientSession, Model } from 'mongoose';
import { MessageMapper } from '../mappers/message.mapper';
import { MessageEntity } from '../domain/entities/message.entity';

@Injectable()
export class MessageRepositoryMongo {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<Message>,
    private mapper: MessageMapper,
  ) {}

  /**
   * 메시지 전송
   */
  async createMessage(
    chatRoomId: string,
    senderId: string,
    receiverId: string,
    content: string,
    messageType: MessageType = MessageType.TEXT,
    fileUrl?: string,
    fileName?: string,
  ): Promise<MessageEntity> {
    const result = await this.messageModel.insertOne({
      conversationId: chatRoomId,
      senderId,
      receiverId,
      message: content,
      messageType,
      readAt: null,
      fileUrl,
      fileName,
    });
    return this.mapper.toEntity(result);
  }

  /**
   * 대화방 메시지 히스토리 조회 (페이지내이션)
   */
  async findMessagesByRoomId(
    chatRoomId: string,
    pagination: Required<PaginationOptions>,
  ): Promise<PaginatedResult<MessageEntity>> {
    const skip = PaginationUtil.getSkip(pagination.page, pagination.limit);

    // 정렬 방향: 1 (오름차순), -1 (내림차순)
    const sortDirection = pagination.sortOrder === 'ASC' ? 1 : -1;

    // 동적 필드명으로 정렬 객체 생성
    const sort: Record<string, 1 | -1> = {
      [pagination.sortBy]: sortDirection as 1 | -1,
    };

    const [items, total] = await Promise.all([
      this.messageModel
        .find({ conversationId: chatRoomId })
        .skip(skip)
        .limit(pagination.limit)
        .sort(sort)
        .lean()
        .exec(),
      this.messageModel
        .countDocuments({
          conversationId: chatRoomId,
        })
        .lean()
        .exec(),
    ]);

    // ✨ Mapper로 Entity 변환
    const entities = this.mapper.toEntities(items);

    return PaginationUtil.paginate<MessageEntity>(entities, total, {
      page: pagination.page,
      limit: pagination.limit,
    });
  }

  /**
   * 읽음 처리
   */
  async markMessagesAsRead(
    chatRoomId: string,
    receiverId: string,
  ): Promise<number> {
    const result = await this.messageModel
      .updateMany(
        {
          conversationId: chatRoomId,
          readAt: null,
          receiverId,
        },
        {
          $set: {
            readAt: new Date(),
          },
        },
      )
      .exec();
    return result.modifiedCount;
  }

  /**
   * 안읽은 메시지 수 조회
   */
  async countUnreadMessagesByRoomAndUser(
    chatRoomId: string,
    userId: string,
  ): Promise<number> {
    return this.messageModel
      .countDocuments({
        conversationId: chatRoomId,
        readAt: null,
        receiverId: userId,
      })
      .exec();
  }

  async deleteMessagesByChatRoomId(chatRoomId: string, session?: ClientSession): Promise<void> {
    const query = this.messageModel.deleteMany({ conversationId: chatRoomId });

    if (session) query.session(session);
    await query.exec();
  }
}
