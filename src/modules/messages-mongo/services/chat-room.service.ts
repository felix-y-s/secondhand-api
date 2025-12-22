import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChatRoomRepositoryMongo } from '../repositories/chat-room.repository.mongo';
import { ChatRoomEntity } from '../domain/entities/chat-room.entity';
import { UsersService } from '@/modules/users/users.service';
import { ProductsService } from '@/modules/products/products.service';
import { ClientSession } from 'mongoose';
import { PaginatedResult, PaginationOptions } from '@/common/types';
import { MessageEntity } from '../domain/entities/message.entity';

@Injectable()
export class ChatRoomService {
  constructor(
    private readonly repository: ChatRoomRepositoryMongo,
    private readonly usersService: UsersService,
    private readonly productsService: ProductsService,
  ) {}

  /**
   * 대화창 조회 및 생성
   * @param senderId 발신인 아이디
   * @param receiverId 수신인 아이디
   * @param productId 상품 아이디
   * @returns { chatRoom: ChatRoomEntity, isCreated: boolean }
   */
  async findOrCreateChatroom(
    senderId: string,
    receiverId: string,
    productId: string,
  ): Promise<{ chatRoom: ChatRoomEntity; isCreated: boolean }> {
    // 사용자 존재 유무 확인
    await this.usersService.ensureUserExists(senderId);
    await this.usersService.ensureUserExists(receiverId);

    // 상품 존재 유무 확인
    await this.productsService.ensureProductExists(productId);

    // 대화방 조회 및 생성
    return await this.repository.findOrCreateChatRoom(
      senderId,
      receiverId,
      productId,
    );
  }

  async ensureUserCanAccessChatRoom(
    chatRoomId: string,
    userId: string,
  ): Promise<ChatRoomEntity> {
    const chatRoom = await this.repository.findChatRoomById(chatRoomId);
    // 1. 존재하지 않는 대화방 조회 시 예외 처리
    if (!chatRoom) {
      throw new NotFoundException('대화방을 찾을 수 없습니다');
    }

    // 2. 참가중인 사용자만 대화방 조회 가능
    const isParticipant = chatRoom.participants.some(
      (p) => p.userId === userId && p.leftAt === null,
    );

    if (!isParticipant) {
      throw new ForbiddenException(
        '권한이 없습니다', // 인증은 되었으나 권한없음
      );
    }

    return chatRoom;
  }

  async getChatRoomList(
    userId: string,
    pagination: Required<PaginationOptions>,
  ): Promise<PaginatedResult<ChatRoomEntity>> {
    return this.repository.findChatRoomsByUserId(userId, pagination);
  }

  /**
   * 대화방 존재 유무 확인
   * @param chatRoomId 대화방 ID
   * @throws NotFoundException - 대화방을 찾을 수 없는 경우
   */
  async ensureChatRoomExist(chatRoomId: string): Promise<void> {
    const chatRoom = await this.repository.findChatRoomById(chatRoomId);
    if (!chatRoom) {
      throw new NotFoundException('대화방을 찾을 수 없습니다');
    }
  }

  /**
   * 대화방에 나간 사용자 정보 업데이트
   */
  async markUserAsLeft(
    chatRoomId: string,
    userId: string,
    session?: ClientSession,
  ): Promise<void> {
    // participants.leftAt 업데이트
    await this.repository.markParticipantsAsLeft(chatRoomId, userId, session);
  }

  /**
   * 모든 사용자가 나갔는지 확인
   */
  async isChatRoomEmpty(
    chatRoomId: string,
    session?: ClientSession,
  ): Promise<boolean> {
    const chatRoom = await this.repository.findChatRoomById(
      chatRoomId,
      session,
    );
    return chatRoom?.participantsCount === 0;
  }

  async removeChatRoomById(
    chatRoomId: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.repository.deleteChatRoom(chatRoomId, session);
  }

  async updateLastMessage(chatRoomId: string, { lastMessage, lastMessageId }: { lastMessage: string; lastMessageId: string }): Promise<void> {
    await this.repository.updateLastMessage(chatRoomId, { lastMessage, lastMessageId });
  }
}
