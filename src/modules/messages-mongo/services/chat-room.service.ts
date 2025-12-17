import { Injectable, NotFoundException } from '@nestjs/common';
import { ChatRoomRepositoryMongo } from '../repositories/chat-room.repository.mongo';
import { ChatRoomEntity } from '../domain/entities/chat-room.entity';
import { UsersService } from '@/modules/users/users.service';
import { ProductsService } from '@/modules/products/products.service';
import { ClientSession } from 'mongoose';

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
  async markUserAsLeft(chatRoomId: string, userId: string, session?: ClientSession): Promise<void> {
    // participants.leftAt 업데이트
    await this.repository.markParticipantsAsLeft(chatRoomId, userId, session);
  }

  /**
   * 모든 사용자가 나갔는지 확인
   */
  async isChatRoomEmpty(chatRoomId: string, session?: ClientSession): Promise<boolean> {
    const chatRoom = await this.repository.findChatRoomById(chatRoomId, session);
    return chatRoom?.participantsCount === 0;
  }

  async removeChatRoomById(chatRoomId: string, session?: ClientSession): Promise<void> {
    await this.repository.deleteChatRoom(chatRoomId, session);
  }
}
