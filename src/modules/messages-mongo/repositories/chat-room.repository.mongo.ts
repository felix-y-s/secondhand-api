import { PaginationOptions } from '@/common/types';
import { ChatRoom } from '../schemas';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { ChatRoomEntity } from '../domain/entities/chat-room.entity';
import { ChatRoomMapper } from '../mappers/chat-room.mapper';
import { PaginationUtil } from '@/common/utils';

@Injectable()
export class ChatRoomRepositoryMongo {
  constructor(
    @InjectModel(ChatRoom.name) private chatRoomModel: Model<ChatRoom>,
    private mapper: ChatRoomMapper,
  ) {}

  /**
   * 대화방 생성 또는 조회
   * - 같은 상품에 대한 대화방이 이미 있으면 기존 대화방 반환
   *
   * NOTE: 동시성 제어 미적용
   *
   * 이유:
   * 1. 동일 사용자가 동일 상품에 동시 요청할 확률 <0.1%
   * 2. 프론트엔드 중복 클릭 방지로 대부분 차단 가능
   * 3. 설령 중복 생성되어도 시스템 영향 미미
   *
   * 모니터링:
   * - 중복 대화방 생성 건수 추적 (월 1회 확인)
   * - 임계치(월 10건) 초과 시 동시성 제어 추가 검토
   *
   * 작성일: 2025-11-18
   *
   * @returns { chatRoom: ChatRoomEntity, isCreated: boolean }
   */
  async findOrCreateChatRoom(
    senderId: string,
    receiverId: string,
    productId: string,
  ): Promise<{ chatRoom: ChatRoomEntity; isCreated: boolean }> {
    const chatRoom = await this.chatRoomModel
      .find({
        productId: productId, // 최상위 필드
        'participants.userId': { $all: [senderId, receiverId] },
        participantsCount: 2, // 정확한 매칭을 위해 참가자 수도 확인
      })
      .exec();

    // 대화방이 이미 존재하면 반환
    if (chatRoom.length > 0) {
      return {
        chatRoom: this.mapper.toEntity(chatRoom[0]),
        isCreated: false,
      };
    }

    // 대화방이 없으면 생성
    const newChatRoom = new this.chatRoomModel({
      productId,
      participants: [
        { userId: senderId, joinedAt: new Date() },
        { userId: receiverId, joinedAt: new Date() },
      ],
      participantsCount: 2, // 정확한 매칭을 위한 참가자 수
    });
    return {
      chatRoom: this.mapper.toEntity(await newChatRoom.save()),
      isCreated: true,
    };
  }

  /**
   * 대화방 목록 조회 (사용자 별)
   */
  async findChatRoomsByUserId(
    userId: string,
    pagination: Required<PaginationOptions>,
  ) {
    const skip = (pagination.page - 1) * pagination.limit;

    // 정렬 방향: 1 (오름차순), -1 (내림차순)
    const sortDirection = pagination.sortOrder === 'ASC' ? 1 : -1;

    // 동적 필드명으로 정렬 객체 생성
    const sort: Record<string, 1 | -1> = {
      [pagination.sortBy]: sortDirection as 1 | -1,
    };

    const [chatRooms, total] = await Promise.all([
      this.chatRoomModel
        .find({
          'participants.userId': userId,
        })
        .skip(skip)
        .limit(pagination.limit)
        .sort(sort)
        .exec(),
      this.chatRoomModel
        .countDocuments({
          'participants.userId': userId,
        })
        .exec(),
    ]);

    const entities = this.mapper.toEntities(chatRooms);

    return PaginationUtil.paginate<ChatRoomEntity>(entities, total, {
      page: pagination.page,
      limit: pagination.limit,
    });
  }

  /**
   * 대화방 상세 조회(대화방 + 사용자 정보)
   */
  async findChatRoomById(
    chatRoomId: string,
    session?: ClientSession,
  ): Promise<ChatRoomEntity | null> {
    const query = this.chatRoomModel.findOne({
      _id: new Types.ObjectId(chatRoomId),
    });

    if (session) {
      query.session(session);
    }

    const chatRoom = await query.lean().exec();
    return this.mapper.toEntityOrNull(chatRoom);
  }

  /**
   * 업데이트 lastMessage
   * - updatedAt 자동 갱신
   * - 새 메시지 전송 시 대화방 목록 정렬을 위해 사용
   */
  async updateLastMessage(
    chatRoomId: string,
    {
      lastMessage,
      lastMessageId,
    }: { lastMessage: string; lastMessageId: string },
  ) {
    const lastMessageAt = new Date();
    await this.chatRoomModel.updateOne(
      { _id: new Types.ObjectId(chatRoomId) },
      { $set: { lastMessage, lastMessageId, lastMessageAt } },
    );
  }

  /**
   * 주문 아이디 업데이트
   * - 구매자가 주문을 생성하면 대화방에 주문 아이디를 업데이트
   */
  async updateProductId(chatRoomId: string, productId: string): Promise<void> {
    await this.chatRoomModel
      .updateOne(
        { _id: new Types.ObjectId(chatRoomId) },
        { $set: { productId } },
      )
      .exec();
  }

  /**
   * 대화방에서 나가기한 시간 업데이트
   */
  async markParticipantsAsLeft(
    chatRoomId: string,
    userId: string,
    session?: ClientSession,
  ): Promise<void> {
    const queryCondition = {
      _id: new Types.ObjectId(chatRoomId),
      participants: {
        $elemMatch: {
          userId,
          leftAt: null,
        },
      },
    };

    const query = this.chatRoomModel.updateOne(queryCondition, {
      $set: { 'participants.$.leftAt': new Date() },
      $inc: { participantsCount: -1 },
    });

    if (session) query.session(session);

    const result = await query.exec();

    if (result.matchedCount === 0) {
      throw new Error('대화방을 찾을 수 없습니다');
    }

    if (result.modifiedCount === 0) {
      throw new Error('이미 나간 사용자입니다');
    }
  }

  /**
   * 대화방 삭제
   */
  async deleteChatRoom(
    chatRoomId: string,
    session?: ClientSession,
  ): Promise<void> {
    const query = this.chatRoomModel.deleteOne({
      _id: new Types.ObjectId(chatRoomId),
    });

    if (session) query.session(session);
    await query.exec();
  }
}
