import { Injectable } from '@nestjs/common';
import { MessageType } from './domain/enums/message-type.enum';
import { PaginatedResult, PaginationOptions } from '@/common/types';
import { ChatRoomService, MessageService } from './services'
import { MessageEntity } from './domain/entities/message.entity';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class MessagesMongoService {
  constructor(
    private readonly chatRoomService: ChatRoomService,
    private readonly messageService: MessageService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  /**
   * 대화방 생성 또는 조회
   *
   * @param senderId 발신인 ID
   * @param receiverId 수신인 ID
   * @param productId 상품 ID
   */
  async findOrCreateChatroom(
    senderId: string,
    receiverId: string,
    productId: string,
  ) {
    // 대화방 레포지토리 클래스에 접근 필요
    return await this.chatRoomService.findOrCreateChatroom(
      senderId,
      receiverId,
      productId,
    );
  }

  /**
   * 대화방에 메시지를 전송하는 서비스 메서드
   *
   * @param chatRoomId 방 ID
   * @param senderId 발신인 ID
   * @param receiverId 수신인 ID
   * @param content 메시지 내용
   * @param messageType 메시지 타입("TEXT" | "IMAGE" | "FILE" | "SYSTEM")
   * @param fileUrl 파일 URL
   * @param fileName 파일 이름
   */
  async sendMessage(
    chatRoomId: string,
    senderId: string,
    receiverId: string,
    content: string,
    messageType: MessageType,
    fileUrl?: string,
    fileName?: string,
  ): Promise<MessageEntity> {
    return await this.messageService.sendMessage(
      chatRoomId,
      senderId,
      receiverId,
      content,
      messageType,
      fileUrl,
      fileName,
    );
  }

  /**
   * 방별 메시지 조회
   *
   * @param chatRoomId 방 ID
   * @param pagination 페이지네이션 옵션
   * @returns 메시지 리스트
   */
  async findMessagesByRoomId(
    chatRoomId: string,
    pagination: Required<PaginationOptions>,
  ): Promise<PaginatedResult<MessageEntity>> {
    return await this.messageService.findMessagesByRoomId(
      chatRoomId,
      pagination,
    );
  }

  /**
   * 메시지 읽음 처리
   *
   * @param chatRoomId 방 ID
   * @param userId 사용자 ID
   */
  async markMessagesAsRead(
    chatRoomId: string,
    userId: string,
  ): Promise<number> {
    return await this.messageService.markMessagesAsRead(chatRoomId, userId);
  }

  /**
   * 방별 안 읽은 메시지 수를 조회하는 서비스 메서드
   *
   * @param chatRoomId 방 ID
   * @param userId 사용자 ID
   * @returns 안 읽은 메시지 수
   */
  async countUnreadMessagesByRoom(chatRoomId: string, userId: string) {
    return await this.messageService.countUnreadMessagesByRoom(
      chatRoomId,
      userId,
    );
  }

  /**
   * 대화방 나가기
   *
   * 프로덕션: 트랜잭션으로 원자성 보장 (Replica Set 필요)
   * 개발환경: 순차 실행 (Standalone MongoDB)
   *
   * 1. 사용자 나가기 처리
   * 2. 모든 사용자가 나간 경우:
   *    - 대화방 삭제
   *    - 연결된 모든 메시지 삭제
   */
  async leaveChatroom(chatRoomId: string, userId: string): Promise<void> {
    // Replica Set 사용 가능 여부 확인
    const isReplicaSet = this.connection.db?.admin ?
      await this.isReplicaSetAvailable() : false;

    if (isReplicaSet) {
      // 프로덕션: 트랜잭션 사용
      await this.leaveChatroomWithTransaction(chatRoomId, userId);
    } else {
      // 개발환경: 순차 실행
      await this.leaveChatroomWithoutTransaction(chatRoomId, userId);
    }
  }

  /**
   * 트랜잭션을 사용한 대화방 나가기 (프로덕션)
   */
  private async leaveChatroomWithTransaction(
    chatRoomId: string,
    userId: string,
  ): Promise<void> {
    const session = await this.connection.startSession();

    try {
      await session.withTransaction(async () => {
        await this.chatRoomService.markUserAsLeft(chatRoomId, userId, session);

        const isEmpty = await this.chatRoomService.isChatRoomEmpty(
          chatRoomId,
          session,
        );

        if (isEmpty) {
          await Promise.all([
            this.chatRoomService.removeChatRoomById(chatRoomId, session),
            this.messageService.removeMessagesByChatRoomId(chatRoomId, session),
          ]);
        }
      });
    } catch (error) {
      throw new Error(`대화방 나가기 실패: ${error.message}`);
    } finally {
      await session.endSession();
    }
  }

  /**
   * 트랜잭션 없이 대화방 나가기 (개발환경)
   *
   * ⚠️ 주의: 원자성이 보장되지 않음
   * - 중간 실패 시 데이터 불일치 가능
   * - 개발/테스트 환경에서만 사용
   */
  private async leaveChatroomWithoutTransaction(
    chatRoomId: string,
    userId: string,
  ): Promise<void> {
    try {
      // 1. 사용자 나가기 처리
      await this.chatRoomService.markUserAsLeft(chatRoomId, userId);

      // 2. 모든 사용자가 퇴장했는지 확인
      const isEmpty = await this.chatRoomService.isChatRoomEmpty(chatRoomId);

      if (isEmpty) {
        // 3. 대화방과 메시지 순차 삭제
        await this.chatRoomService.removeChatRoomById(chatRoomId);
        await this.messageService.removeMessagesByChatRoomId(chatRoomId);
      }
    } catch (error) {
      throw new Error(`대화방 나가기 실패: ${error.message}`);
    }
  }

  /**
   * Replica Set 사용 가능 여부 확인
   */
  private async isReplicaSetAvailable(): Promise<boolean> {
    try {
      const admin = this.connection.db?.admin();
      const result = await admin?.replSetGetStatus();
      return result?.ok === 1;
    } catch (error) {
      // Replica Set이 아니면 에러 발생
      return false;
    }
  }
}
