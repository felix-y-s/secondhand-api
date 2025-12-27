import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MessageRepositoryMongo } from '../repositories/messages.repository.mongo';
import { MessageType } from '../domain/enums/message-type.enum';
import { PaginatedResult, PaginationOptions } from '@/common/types';
import { PaginationUtil } from '@/common/utils';
import { MessageEntity } from '../domain/entities/message.entity';
import { UsersService } from '@/modules/users/users.service';
import { ChatRoomService } from './chat-room.service';
import { ClientSession } from 'mongoose';
import { EventPublisherService } from '@/events/publishers/event-publisher.service';
import { EventType } from '@/events/types/event.types';
import type { MessageSentEvent } from '@/events/types/event.types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MessageService {
  constructor(
    private readonly repository: MessageRepositoryMongo,
    private readonly usersService: UsersService,
    private readonly chatRoomService: ChatRoomService,
    private readonly eventPublisher: EventPublisherService,
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

    const message = await this.repository.createMessage(
      chatRoomId,
      senderId,
      receiverId,
      content,
      messageType,
      fileUrl,
      fileName,
    );

    await this.afterMessageSent(chatRoomId, message);

    return message;
  }

  /**
   * 메시지 발송 후 처리 - 이벤트 발행
   *
   * 이벤트 기반 처리로 변경:
   * - 마지막 메시지 업데이트
   * - 알림 전송
   * - 읽지 않은 메시지 카운트 업데이트
   * - 통계 업데이트
   * 등의 로직이 각각의 이벤트 핸들러에서 독립적으로 처리됨
   */
  private async afterMessageSent(chatRoomId: string, message: MessageEntity) {
    // 메시지 발송 이벤트 생성
    const event: MessageSentEvent = {
      eventId: uuidv4(),
      eventType: EventType.MESSAGE_SENT,
      timestamp: new Date(),
      data: {
        messageId: message.id,
        chatRoomId: chatRoomId,
        senderId: message.senderId,
        receiverId: message.receiverId,
        message: message.message,
        messageType: message.messageType,
        fileUrl: message.fileUrl,
        fileName: message.fileName,
      },
    };

    // 로컬 이벤트 발행 (같은 프로세스 내 핸들러들이 처리)
    this.eventPublisher.emitLocal(event);

    // 또는 분산 이벤트 발행 (다른 서비스에서도 처리 가능)
    // await this.eventPublisher.emitDistributed(event);

    // 또는 로컬 + 분산 동시 발행
    // await this.eventPublisher.emitAll(event);
  }

  async findMessagesByRoomId(
    roomId: string,
    userId: string,
    pagination: Required<PaginationOptions>,
  ): Promise<PaginatedResult<MessageEntity>> {
    await this.chatRoomService.ensureUserCanAccessChatRoom(roomId, userId);

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

  async removeMessagesByChatRoomId(
    chatRoomId: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.repository.deleteMessagesByChatRoomId(chatRoomId, session);
  }
}
