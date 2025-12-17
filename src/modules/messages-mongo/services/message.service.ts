import { Injectable } from '@nestjs/common';
import { MessageRepositoryMongo } from '../repositories/messages.repository.mongo';
import { MessageType } from '../domain/enums/message-type.enum';
import { PaginatedResult, PaginationOptions } from '@/common/types';
import { PaginationUtil } from '@/common/utils';
import { MessageEntity } from '../domain/entities/message.entity';
import { UsersService } from '@/modules/users/users.service';
import { ChatRoomService } from './chat-room.service';
import { ClientSession } from 'mongoose';

@Injectable()
export class MessageService {
  constructor(private readonly repository: MessageRepositoryMongo,
    private readonly usersService: UsersService,
    private readonly chatRoomService: ChatRoomService,
  ) {}

  async sendMessage(
    chatRoomId: string,
    senderId: string,
    receiverId: string,
    content: string,
    messageType: MessageType,
    fileUrl?: string,
    fileName?: string,
  ): Promise<MessageEntity> {
    // 사용자 존재 유무 확인
    await this.usersService.ensureUserExists(senderId);
    await this.usersService.ensureUserExists(receiverId);

    // 대화방 존재 확인
    await this.chatRoomService.ensureChatRoomExist(chatRoomId);

    return await this.repository.createMessage(
      chatRoomId,
      senderId,
      receiverId,
      content,
      messageType,
      fileUrl,
      fileName,
    );
  }

  async findMessagesByRoomId(
    roomId: string,
    pagination: Required<PaginationOptions>,
  ): Promise<PaginatedResult<MessageEntity>> {
    return this.repository.findMessagesByRoomId(roomId, pagination);
  }

  async markMessagesAsRead(roomId: string, userId: string): Promise<number> {
    return await this.repository.markMessagesAsRead(roomId, userId);
  }

  async countUnreadMessagesByRoom(
    roomId: string,
    userId: string,
  ): Promise<number> {
    return await this.repository.countUnreadMessagesByRoomAndUser(
      roomId,
      userId,
    );
  }

  async removeMessagesByChatRoomId(chatRoomId: string, session?: ClientSession): Promise<void> {
    await this.repository.deleteMessagesByChatRoomId(chatRoomId, session);
  }
}
