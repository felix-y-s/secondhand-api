import { PrismaService } from '@/prisma/prisma.service';
import { TestDataFactory } from '../../../test/fixtures/test-data.factory';
import { Model } from 'mongoose';
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

  static async create(deps: MessageDataFixtureDeps) {
    const instance = new MessageDataFixture();
    instance.testDataFactory = new TestDataFactory(
      deps.prismaService,
      deps.configService,
      deps.jwtService,
    );
    instance.chatRoomModel = deps.chatRoomModel;
    instance.messageModel = deps.messageModel;
    return instance;
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
    const { seller, buyer } = await this.testDataFactory.createSellerAndBuyer();

    if (!seller.token || !buyer.token) {
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
      senderToken: buyer.token,
      receiverId: seller.id,
      receiverToken: seller.token,
      productId: product.id,
    };
  }

  /**
   * 테스트용 대화방 생성 (MongoDB에 직접 삽입)
   */
  private async createChatRoom(
    senderId: string,
    receiverId: string,
    productId: string,
  ): Promise<ChatRoom> {
    if (!this.chatRoomModel) {
      throw new Error(
        'ChatRoomModel이 주입되지 않았습니다. create() 메서드에 chatRoomModel을 전달해주세요.',
      );
    }

    const chatRoom = new this.chatRoomModel({
      productId,
      participants: [
        { userId: senderId, joinedAt: new Date() },
        { userId: receiverId, joinedAt: new Date() },
      ],
      participantsCount: 2,
    });

    return await chatRoom.save();
  }

  async createChatRoomFixture() {
    const { senderId, receiverId, productId } =
      await this.createChatTestContext();
    const chatRoom = await this.createChatRoom(senderId, receiverId, productId);

    return {
      senderId,
      receiverId,
      productId,
      chatRoom,
    };
  }

  /**
   * 테스트 데이터 + 대화방 한 번에 생성
   */
  async createChatRoomWithMessagesFixture(messageCount: number) {
    const messageModel = this.messageModel;
    if (!messageModel) {
      throw new Error('messageModel이 주입되지 않았습니다.');
    }

    const { senderId, receiverId, productId, chatRoom } =
      await this.createChatRoomFixture();

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
          conversationId: chatRoom.id,
          senderId,
          receiverId,
          message: `테스트 메시지 _${index}`,
          messageType: MessageType.TEXT,
        });
      }),
    );

    return {
      senderId,
      receiverId,
      productId,
      chatRoom,
      messages: newMessages,
    };
  }

  /**
   * 테스트 데이터 + 대화방 한 번에 생성
   */
  async createAuthenticatedChatRoomContext() {
    const result = await this.createAuthenticatedChatTestContext();
    const chatRoom = await this.createChatRoom(
      result.senderId,
      result.receiverId,
      result.productId,
    );

    return {
      senderId: result.senderId,
      senderToken: result.senderToken,
      receiverId: result.receiverId,
      receiverToken: result.receiverToken,
      productId: result.productId,
      chatRoomId: chatRoom.id,
    };
  }

  async cleanupAll() {
    await this.testDataFactory.cleanupAll();
  }
}
