import {
  ForbiddenException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppModule } from '@/app.module';
import { MessagesMongoService } from './messages-mongo.service';
import { PrismaService } from '@/prisma/prisma.service';
import { MessageDataFixture } from './__tests__/message-data.fixture';
import { ChatRoom, Message } from './schemas';
import { MessageType } from './domain/enums/message-type.enum';
import { v4 as uuidv4 } from 'uuid';

describe('MessagesMongoService 통합 테스트', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let service: MessagesMongoService;
  let prismaService: PrismaService;
  let testMessageDataFactory: MessageDataFixture;
  let chatRoomModel: Model<ChatRoom>;
  let messageModel: Model<Message>;
  let senderId: string;
  let receiverId: string;
  let productId: string;

  beforeAll(async () => {
    // 1. 인메모리 MongoDB 서버 시작
    mongod = await MongoMemoryServer.create();
    const mongoUrl = mongod.getUri();

    // 2. 테스트 모듈 생성 (AppModule 전체 사용)
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('MONGODB_URI')
      .useValue(mongoUrl)
      .compile();

    // 3. 애플리케이션 초기화
    app = moduleFixture.createNestApplication();
    await app.init();

    // 4. 서비스 및 의존성 가져오기
    service = app.get<MessagesMongoService>(MessagesMongoService);
    prismaService = app.get<PrismaService>(PrismaService);
    chatRoomModel = app.get<Model<ChatRoom>>(getModelToken(ChatRoom.name));
    messageModel = app.get<Model<Message>>(getModelToken(Message.name));

    // 5. 테스트 데이터 팩토리 생성 (ChatRoomModel 포함)
    testMessageDataFactory = new MessageDataFixture({
      prismaService,
      chatRoomModel,
      messageModel,
    });

    // 6. 테스트 사용자 만들기
    ({ senderId, receiverId, productId } =
      await testMessageDataFactory.createChatTestContext());
  }, 30000); // MongoDB 서버 시작 시간 고려

  afterAll(async () => {
    // 각 테스트 후 모든 컬렉션 데이터 정리
    const connection = app.get('DatabaseConnection');
    const collections = await connection.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }

    // 테스트 데이터 정리
    await testMessageDataFactory.cleanupAll();

    // MongoDB 서버 및 앱 종료
    await mongod.stop();
    await app.close();
  });

  describe('대화방 찾기 & 만들기', () => {
    it('새로운 대화방 만들기', async () => {
      // 대화방 만들기
      const { chatRoom: createdRoom } = await service.findOrCreateChatroom(
        senderId,
        receiverId,
        productId,
      );
      const createdId = createdRoom.id;
      expect(createdRoom.productId).toBe(productId);
      expect(createdRoom.participants).toHaveLength(2);
    });
    it('기존 대화방 조회', async () => {
      // Given: 대화방 만들기
      const chatRoom =
        await testMessageDataFactory.createChatRoomFixture(senderId, receiverId, productId);
      const chatRoomId = chatRoom.id;

      // When: 대화방 조회
      const { chatRoom: createdRoom } = await service.findOrCreateChatroom(
        senderId,
        receiverId,
        productId,
      );

      // Then: 대화방 생성 검증
      expect(createdRoom.id).toBe(chatRoomId);
      expect(createdRoom.productId).toBe(productId);
      expect(createdRoom.participants).toHaveLength(2);
    });

    describe('실패 케이스', () => {
      it('존재하지 않는 사용자와 대화 시도 시 NotFoundException를 던진다', async () => {
        // Given: 존재하지 않는 사용자
        const notExistUserId = uuidv4();

        // When & Then: 대화방 조회
        await expect(
          service.findOrCreateChatroom(notExistUserId, receiverId, productId),
        ).rejects.toThrow(new NotFoundException('사용자를 찾을 수 없습니다'));
      });
      it('존재하지 않는 상품 아이디로 대화 시도 시 NotFoundException를 던진다', async () => {
        // Given: 존재하지 않는 상품
        const notExistProductId = uuidv4();

        // When & Then: 대화방 조회
        await expect(
          service.findOrCreateChatroom(senderId, receiverId, notExistProductId),
        ).rejects.toThrow(new NotFoundException('상품을 찾을 수 없습니다'));
      });
    });
  });

  describe('메시지 전송', () => {
    let chatRoomId: string;
    beforeAll(async () => {
      // 테스트 대화방 생성
      const chatRoom = await testMessageDataFactory.createChatRoomFixture(
        senderId,
        receiverId,
        productId,
      );
      chatRoomId = chatRoom.id;
    });
    it('메시지 전송 성공', async () => {
      // When: 메시지 전송
      const createdMessage = await service.sendMessage(
        chatRoomId,
        senderId,
        receiverId,
        'test message',
        MessageType.TEXT,
      );

      // Then: 디비에 데이터가 저장되었는지 확인
      const message = await messageModel.findOne({
        _id: createdMessage.id,
      });

      expect(message).toBeDefined();
    });

    it('존재하지 않는 사용자 아이디로 메시지 전송 시 NotFoundException를 던진다.', async () => {
      // Given: 존재하지 않는 사용자
      const notExistUserId = uuidv4();

      // When & Then: 메시지 전송
      await expect(
        service.sendMessage(
          chatRoomId,
          notExistUserId,
          receiverId,
          'test message',
          MessageType.TEXT,
        ),
      ).rejects.toThrow(new NotFoundException('사용자를 찾을 수 없습니다'));
    });

    it('존재하지 않는 대화방 아이디로 메시지 전송 시 NotFoundException를 던진다', async () => {
      // Given: 존재하지 않는 대화방 아이디
      const notExistChatRoomId = new Types.ObjectId().toHexString();

      // When & Then: 메시지 전송
      await expect(
        service.sendMessage(
          notExistChatRoomId,
          senderId,
          receiverId,
          'test message',
          MessageType.TEXT,
        ),
      ).rejects.toThrow(new NotFoundException('대화방을 찾을 수 없습니다'));
    });
  });
  describe('방별 메시지 조회', () => {
    let chatRoomId: string;
    let messages: Message[];
    const messageCount = 10;
    beforeAll(async () => {
      //  테스트 데이터 생성
      const result =
        await testMessageDataFactory.createChatRoomWithMessagesFixture(
          senderId,
          receiverId,
          productId,
          { messageCount },
        );
      chatRoomId = result.chatRoom.id;
      messages = result.messages!;
    });
    it('메시지 조회 성공', async () => {
      // Then: 메시지 조회
      const result = await service.findMessagesByRoomId(
        chatRoomId,
        receiverId,
        {
          page: 1,
          limit: 10,
          sortBy: 'createdAt',
          sortOrder: 'DESC',
        },
      );
      expect(result.items.length).toBe(messageCount);
      expect(result.meta.total).toBe(messageCount);
    });

    it('메시지 조회 성공 - 오름차순', async () => {
      // Given: 첫번째 메시지 조회
      const sortedMessages = messages.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );

      // Then: 메시지 조회
      const result = await service.findMessagesByRoomId(
        chatRoomId,
        receiverId,
        {
          page: 1,
          limit: 10,
          sortBy: 'createdAt',
          sortOrder: 'ASC',
        },
      );
      expect(result.items.length).toBe(messageCount);
      expect(result.meta.total).toBe(messageCount);
      expect(result.items[0].id).toBe(sortedMessages[0].id);
      expect(result.items[messageCount - 1].id).toBe(
        sortedMessages[messageCount - 1].id,
      );
    });

    describe('실패 케이스', () => {
      it('존재하지 않는 대화방 조회 NotFoundException', async () => {
        // Given: 존재하지 않는 대화방으로 메시지 조회
        const notExistRoomId = new Types.ObjectId().toHexString();

        // When & Then: 메시지 조회
        await expect(
          service.findMessagesByRoomId(notExistRoomId, receiverId, {
            page: 1,
            limit: 10,
            sortBy: 'createdAt',
            sortOrder: 'DESC',
          }),
        ).rejects.toThrow(new NotFoundException('대화방을 찾을 수 없습니다'));
      });
      it('권한없는 사용자가 대화방 조회 ForbiddenException', async () => {
        // Given: 권한없는 사용자
        const notExistUser = uuidv4();

        // When & Then: 메시지 조회
        await expect(
          service.findMessagesByRoomId(chatRoomId, notExistUser, {
            page: 1,
            limit: 10,
            sortBy: 'createdAt',
            sortOrder: 'DESC',
          }),
        ).rejects.toThrow(new ForbiddenException('권한이 없습니다'));
      });
    });
  });

  describe('메시지 읽음 처리', () => {
    let chatRoomId: string;
    let messageCount = 10;
    beforeEach(async () => {
      // 테스트 데이터 생성
      const result =
        await testMessageDataFactory.createChatRoomWithMessagesFixture(
          senderId,
          receiverId,
          productId,
          { messageCount },
        );
      chatRoomId = result.chatRoom.id;
    });

    afterEach(async () => {
      await messageModel.deleteMany({});
    });

    it('읽음 처리 완료', async () => {
      // When: 메시지 읽음 처리
      const result = await service.markMessagesAsRead(chatRoomId, receiverId);

      // Then: 메시지 읽음 상태 확인(몽고 서버)
      const updatedMessages = await messageModel.find({
        conversationId: chatRoomId,
        receiverId: receiverId,
      });
      expect(result).toBe(messageCount);
      expect(updatedMessages.every((message) => message.readAt)).toBe(true);
    });
  });

  describe('방별 안읽은 메시지 수를 조회', () => {
    let chatRoomId: string;
    const messageCount = 10;

    beforeAll(async () => {
      const result =
        await testMessageDataFactory.createChatRoomWithMessagesFixture(
          senderId,
          receiverId,
          productId,
          { messageCount },
        );
      chatRoomId = result.chatRoom.id;
    });
    it('방별 메시지 카운트 조회', async () => {
      // When: 메시지 카운트 조회
      const count = await service.countUnreadMessagesByRoom(
        chatRoomId,
        receiverId,
      );

      // Then: 메시지 카운트 확인
      expect(count).toBe(messageCount);
    });

    it('발신인 아이디로 안읽은 메시지 조회 시 메시지 없음', async () => {
      // When: 메시지 조회
      const unreadCount = await service.countUnreadMessagesByRoom(
        chatRoomId,
        senderId,
      );

      // Then: 메시지 없음
      expect(unreadCount).toBe(0);
    });

    it('존재하지 않는 대화방으로 조회시 NotFoundException', async () => {
      // When: 존재하지 않는 대화방으로 조회
      const notExistRoomId = new Types.ObjectId().toHexString();
      const unreadCount = await service.countUnreadMessagesByRoom(
        notExistRoomId,
        receiverId,
      );

      // Then: 메시지 없음
      expect(unreadCount).toBe(0);
    });
  });
});
