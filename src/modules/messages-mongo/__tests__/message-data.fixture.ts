import { PrismaService } from '@/prisma/prisma.service';
import { TestDataFactory } from '../../../test/fixtures/test-data.factory';
import { Model, Types } from 'mongoose';
import { ChatRoom, Message } from '@/modules/messages-mongo/schemas';
import { MessageType } from '@/modules/messages-mongo/domain/enums/message-type.enum';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

interface MessageDataFixtureDeps {
  prismaService: PrismaService;
  configService?: ConfigService;
  jwtService?: JwtService;
  chatRoomModel?: Model<ChatRoom>;
  messageModel?: Model<Message>;
}

/**
 * 📝 fixture, context의 의미
 *
 * fixture:
 *  - 테스트 실행에 필요한 **고정된 테스트 데이터 또는 상태**
 *  - DB 레코드, Mock 객체, 기본 엔티티 세트 등을 포함
 *  - "테스트가 시작되기 전에 준비되는 재료"
 *  - 예: senderId
 *
 * context:
 *  - 특정 테스트 시나리오를 실행하기 위해 **fixture들을 조합한 실행 환경**
 *  - 사용자, 인증 토큰, 연관된 리소스 식별자 등을 함께 포함
 *  - "테스트를 바로 실행할 수 있는 완성된 상황"
 *  - 예: senderToken
 */
export class MessageDataFixture {
  private testDataFactory: TestDataFactory;
  private chatRoomModel?: Model<ChatRoom>;
  private messageModel?: Model<Message>;

  constructor(deps: MessageDataFixtureDeps) {
    this.testDataFactory = new TestDataFactory(
      deps.prismaService,
      deps.configService,
      deps.jwtService,
    );
    this.chatRoomModel = deps.chatRoomModel;
    this.messageModel = deps.messageModel;
  }

  /**
   * @deprecated
   */
  static create(deps: MessageDataFixtureDeps) {
    throw new Error('MessageDataFixture.create는 더 이상 사용되지 않습니다.');
  }

  async createChatTestContext() {
    // 수/발신인 만들기
    const { seller, buyer } = await this.testDataFactory.createSellerAndBuyer();

    // 카테고리 만들기
    const category = await this.testDataFactory.createCategory();

    // 상품 만들기
    const product = await this.testDataFactory.createProduct(
      seller.id,
      category.id,
    );

    return {
      senderId: buyer.id,
      receiverId: seller.id,
      productId: product.id,
    };
  }

  async createAuthenticatedChatTestContext() {
    // 수/발신인 만들기
    const { seller, buyer, sellerToken, buyerToken } =
      await this.testDataFactory.createSellerAndBuyerWithToken();

    if (!sellerToken || !buyerToken) {
      throw new Error('토큰 발생 실패');
    }

    // 카테고리 만들기
    const category = await this.testDataFactory.createCategory();

    // 상품 만들기
    const product = await this.testDataFactory.createProduct(
      seller.id,
      category.id,
    );

    return {
      senderId: buyer.id,
      senderToken: buyerToken,
      receiverId: seller.id,
      receiverToken: sellerToken,
      productId: product.id,
    };
  }

  async createUsersForChatRoomTest(userCount: number = 1) {
    const users: { userId: string; token: string }[] = await Promise.all(
      Array.from({ length: userCount }).map(async (_, index) => {
        const context = await this.testDataFactory.createUserWithToken();
        return { userId: context.user.id, token: context.token };
      }),
    );
    return users;
  }

  /**
   * 테스트용 대화방 생성 (MongoDB에 직접 삽입)
   */
  async createChatRoomFixture(
    senderId: string,
    receiverId: string,
    productId: string,
  ): Promise<ChatRoom> {
    const chatRoomModel = this.ensureChatRoomModel();

    const chatRoom = new chatRoomModel({
      productId,
      participants: [
        { userId: senderId, joinedAt: new Date() },
        { userId: receiverId, joinedAt: new Date() },
      ],
      participantsCount: 2,
    });

    return await chatRoom.save();
  }

  /**
   * 테스트 데이터 + 대화방 + 메시지 한 번에 생성
   */
  async createChatRoomWithMessagesFixture(
    senderId: string,
    receiverId: string,
    productId: string,
    options?: { messageCount?: number },
  ) {
    const chatRoom = await this.createChatRoomFixture(
      senderId,
      receiverId,
      productId,
    );

    const messages = await this.createMessagesFixture(
      senderId,
      receiverId,
      chatRoom.id,
      options,
    );

    return {
      senderId,
      receiverId,
      productId,
      chatRoom,
      messages,
    };
  }

  /**
   * 테스트 대화 생성
   * @param params
   * @param messageCount
   * @returns
   */
  async createMessagesFixture(
    senderId: string,
    receiverId: string,
    chatRoomId: string,
    options?: { messageCount?: number },
  ) {
    const messageModel = this.ensureMessageModel();
    const { messageCount = 1 } = options ?? {};

    if (messageCount < 1) {
      throw new Error('messageCount는 1 이상이어야 합니다.');
    }

    const newMessages = await Promise.all(
      Array.from({ length: messageCount }).map(async (_, index) => {
        // 정렬을 확인하기 위해 각각 insert
        const MIN_DELAY_MS = 300;
        const MAX_DELAY_MS = 1000;
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1) + MIN_DELAY_MS,
          ),
        );
        return messageModel.insertOne({
          conversationId: chatRoomId,
          senderId: senderId,
          receiverId: receiverId,
          message: `테스트 메시지 _${index}`,
          messageType: MessageType.TEXT,
        });
      }),
    );

    return newMessages;
  }

  /**
   * 테스트 데이터 + token + 대화방 한 번에 생성
   */
  async createAuthenticatedChatRoomContext() {
    const context = await this.createAuthenticatedChatTestContext();
    const chatRoom = await this.createChatRoomFixture(
      context.senderId,
      context.receiverId,
      context.productId,
    );

    return {
      senderId: context.senderId,
      senderToken: context.senderToken,
      receiverId: context.receiverId,
      receiverToken: context.receiverToken,
      productId: context.productId,
      chatRoomId: chatRoom.id,
    };
  }
  /**
   * 테스트 데이터 + 대화방 한 번에 생성
   */
  async createChatRoomContext() {
    const context = await this.createChatTestContext();
    const chatRoom = await this.createChatRoomFixture(
      context.senderId,
      context.receiverId,
      context.productId,
    );

    return {
      senderId: context.senderId,
      receiverId: context.receiverId,
      productId: context.productId,
      chatRoomId: chatRoom.id,
    };
  }

  async deleteChatRoomFixture(chatRoomId: string): Promise<void> {
    const chatRoomModel = this.ensureChatRoomModel();
    await chatRoomModel.deleteOne({
      _id: new Types.ObjectId(chatRoomId),
    });
  }

  async deleteMessageFixture(chatRoomId: string): Promise<void> {
    const messageModel = this.ensureMessageModel();
    await messageModel.deleteMany({ conversationId: chatRoomId });
  }

  /**
   * ChatRoomModel 존재 보장
   */
  private ensureChatRoomModel(): Model<ChatRoom> {
    if (!this.chatRoomModel) {
      throw new Error('chatRoomModel이 주입되지 않았습니다.');
    }
    return this.chatRoomModel;
  }

  /**
   * MessageModel 존재 보장
   */
  private ensureMessageModel(): Model<Message> {
    if (!this.messageModel) {
      throw new Error('messageModel이 주입되지 않았습니다.');
    }
    return this.messageModel;
  }

  async cleanupAll() {
    await this.testDataFactory.cleanupAll();
  }
}
