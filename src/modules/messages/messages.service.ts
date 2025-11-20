import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MessageRepository } from './repositories/messages.repository';
import { ProductsService } from '@/modules/products/products.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MessageType, ProductStatus } from '@prisma/client';

@Injectable()
export class MessagesService {
  constructor(
    private readonly repository: MessageRepository,
    private readonly productsService: ProductsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 채팅방 생성 또는 조회
   *
   * 비즈니스 규칙:
   * 1. 상품이 존재해야 함
   * 2. 상품이 판매 가능 상태여야 함
   * 3. 본인 상품에는 채팅 불가
   */
  async findOrCreateChatRoom(userId: string, productId: string) {
    // 상품 존재 확인
    const product = await this.productsService.findById(productId);

    // 본인 상품 확인
    if (product.sellerId === userId) {
      throw new BadRequestException('본인 상품에는 채팅할 수 없습니다.');
    }

    // 상품 상태 확인
    if (product.status === ProductStatus.DELETED) {
      throw new BadRequestException('');
    }

    const chatRoom = await this.repository.findOrCreateChatRoom(
      userId,
      productId,
    );

    // 새 채팅방 생성 시 알림
    if (chatRoom.isNew) {
      this.eventEmitter.emit('chatroom.created', {
        chatRoomId: chatRoom.room.id,
        productId,
        buyerId: userId,
        sellerId: product.sellerId,
      });
    }

    return chatRoom.room;
  }

  /**
   * 메시지 전송
   *
   * 비즈니스 규칙:
   * 1. 채팅방 멤버만 전송 가능
   * 2. 메시지 타입에 따라 검증 (파일, 이미지)
   */
  async sendMessage(
    userId: string,
    chatRoomId: string,
    content: string,
    messageType: MessageType = MessageType.TEXT,
    fileUrl?: string,
    fileName?: string,
  ) {
    // 채팅방 멤버 확인
    const chatRoom = await this.repository.findChatRoomById(chatRoomId);
    if (!chatRoom) {
      throw new NotFoundException('채팅방을 찾을 수 없습니다.');
    }

    const isMember = chatRoom.members.some(
      (member) => member.userId === userId,
    );
    if (!isMember) {
      throw new ForbiddenException('채팅방 멤버만 메시지를 보낼 수 있습니다.');
    }

    // 메시지 생성
    const message = await this.repository.createMessage(
      userId,
      chatRoomId,
      content,
      messageType,
      fileUrl,
      fileName,
    );

    // 채팅방 updatedAt 갱신 (채팅방 목록 정렬용)
    await this.repository.updateChatRoomTimestamp(chatRoomId);

    // 새 메시지 알림 이벤트 발생
    this.eventEmitter.emit('message.created', {
      chatRoomId,
      messageId: message.id,
      senderId: userId,
      recipientIds: chatRoom.members
        .filter((m) => m.userId !== userId)
        .map((m) => m.userId),
    });

    return message;
  }

  /**
   * 채팅방 목록 조회
   */
  async findMyChatRooms(userId: string) {
    const chatRooms = await this.repository.findChatRoomsByUserId(userId);

    const chatRoomsWithUnread = await Promise.all(
      chatRooms.map(async (room) => {
        const unreadCount = await this.repository.getUnreadCount(
          room.id,
          userId,
        );

        return {
          ...room,
          unreadCount,
        };
      }),
    );

    return chatRoomsWithUnread;
  }

  /**
   * 채팅방 메시지 히스토리 조회
   */
  async findMessage(userId: string, chatRoomId: string, page: number = 1) {
    // 채팅방 멤버 확인
    const chatRoom = await this.repository.findChatRoomById(chatRoomId);
    if (!chatRoom) {
      throw new NotFoundException('채팅방을 찾을 수 없습니다');
    }

    // 조회 권한 확인
    const isMember = chatRoom.members.some((user) => user.userId === userId);
    if (!isMember) {
      throw new ForbiddenException(`채팅방 멤버만 조회 가능합니다.`);
    }

    // 메시지 조회
    const messages = await this.repository.findMessagesByRoomId(
      chatRoomId,
      page,
    );

    return messages;
  }

  /**
   * 읽음 처리
   */
  async markAsRead(chatRoomId: string, userId: string) {
    // 채팅방 멤버 확인
    const chatRoom = await this.repository.findChatRoomById(chatRoomId);
    if (!chatRoom) {
      throw new NotFoundException('채팅방을 찾을 수 없습니다.');
    }

    const isMember = chatRoom.members.some((user) => user.userId === userId);

    if (!isMember) {
      throw new ForbiddenException(`권한이 없습니다.`);
    }

    await this.repository.markMessagesAsRead(chatRoomId, userId);
  }

  /**
   * 채팅방 나가기
   */
  async leaveChatRoom(chatRoomId: string, userId: string) {
    // 채팅방 멤버 확인
    const chatRoom = await this.repository.findChatRoomById(chatRoomId);
    console.log('🚀 | MessagesService | leaveChatRoom | chatRoom:', chatRoom);
    if (!chatRoom) {
      throw new NotFoundException(`채팅방을 찾을 수 없습니다.`);
    }

    const isMember = chatRoom.members.some((user) => user.userId === userId);
    if (!isMember) {
      throw new ForbiddenException(`권한이 없습니다.`);
    }

    await this.repository.leaveChatRoom(chatRoomId, userId);
  }
}
