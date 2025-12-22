import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AppModule } from '@/app.module';
import { ChatRoomRepositoryMongo } from './chat-room.repository.mongo';
import { MessageDataFixture } from '../__tests__/message-data.fixture';
import { PrismaService } from '@/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import { ChatRoom, Message } from '../schemas';
import { getModelToken } from '@nestjs/mongoose';

/**
 * ChatRoomsRepositoryMongo 통합 테스트
 */
describe('ChatRoomsRepositoryMongo Integration', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let repository: ChatRoomRepositoryMongo;
  let fixture: MessageDataFixture;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const mongoUrl = mongod.getUri();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('MONGODB_URI')
      .useValue(mongoUrl)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    repository = app.get(ChatRoomRepositoryMongo);

    const prismaService = app.get<PrismaService>(PrismaService);
    const configService = app.get<ConfigService>(ConfigService);
    const jwtService = app.get<JwtService>(JwtService);
    const chatRoomModel = app.get<Model<ChatRoom>>(getModelToken(ChatRoom.name));
    const messageModel = app.get<Model<Message>>(getModelToken(Message.name));

    fixture = new MessageDataFixture({
      prismaService,
      configService,
      jwtService,
      chatRoomModel,
      messageModel,
    });
  });

  afterAll(async () => {
    await mongod.stop();
    await app.close();
  });

  afterEach(async () => {
    const connection = app.get('DatabaseConnection');
    const collections = await connection.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }
  });

  it('대화방이 없으면 생성하고 문서를 반환한다', async () => {
    const senderId = 'user-A';
    const receiverId = 'user-B';
    const productId = 'product-1';

    const { chatRoom } = await repository.findOrCreateChatRoom(
      senderId,
      receiverId,
      productId,
    );

    expect(chatRoom).toBeDefined();
    expect((chatRoom as any)._id).toBeDefined();
    expect(chatRoom.productId).toBe(productId);
    expect(Array.isArray(chatRoom.participants)).toBe(true);
    expect(chatRoom.participants).toHaveLength(2);
    const ids = chatRoom.participants.map((p) => p.userId).sort();
    expect(ids).toEqual([receiverId, senderId].sort());
  });

  it('같은 사용자/상품 조합으로 다시 호출하면 기존 대화방을 반환한다', async () => {
    const senderId = 'user-A';
    const receiverId = 'user-B';
    const productId = 'product-1';

    const first = await repository.findOrCreateChatRoom(
      senderId,
      receiverId,
      productId,
    );

    const second = await repository.findOrCreateChatRoom(
      senderId,
      receiverId,
      productId,
    );

    expect(String((second as any)._id)).toBe(String((first as any)._id));
  });

  describe('대화방 목록 조회', () => {
    const roomsCount = 5;
    const receiverId = `recv-user-1`;
    const productId = `product-1`;

    beforeAll(async () => {
      // test context 생성
      for (let i = 0; i < roomsCount; i++) {
        const senderId = `send-user-${i}`;
        await fixture.createChatRoomFixture(senderId, receiverId, productId);
      }
    });

    it('정상적인 경우 - 페이지네이션 구조 검증', async () => {
      const result = await repository.findChatRoomsByUserId(receiverId, {
        page: 1,
        limit: 10,
        sortBy: 'updatedAt',
        sortOrder: 'DESC',
      });
      console.log('🚀 | result:', result);

      // 1. 기본 구조 검증
      expect(result).toBeDefined();
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('meta');
      expect(Array.isArray(result.items)).toBe(true);

      // 2. 아이템 개수 검증
      expect(result.items).toHaveLength(roomsCount);

      // 3. 메타데이터 검증
      expect(result.meta).toHaveProperty('page');
      expect(result.meta).toHaveProperty('limit');
      expect(result.meta).toHaveProperty('total');
      expect(result.meta).toHaveProperty('totalPages');
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.total).toBe(roomsCount);
      expect(result.meta.totalPages).toBe(1);

      // 4. 각 대화방 구조 검증
      result.items.forEach((room) => {
        expect(room).toHaveProperty('id');
        expect(room).toHaveProperty('productId');
        expect(room).toHaveProperty('participants');
        expect(room).toHaveProperty('participantsCount');
        expect(room).toHaveProperty('lastMessage');
        expect(room).toHaveProperty('lastMessageId');
        expect(room).toHaveProperty('lastMessageAt');
        expect(room).toHaveProperty('relatedOrderId');
        expect(room).toHaveProperty('createdAt');
        expect(room).toHaveProperty('updatedAt');

        // participants 배열 검증
        expect(Array.isArray(room.participants)).toBe(true);
        expect(room.participantsCount).toBe(2);

        // receiverId가 participants에 포함되어 있는지 확인
        const userIds = room.participants.map((p) => p.userId);
        expect(userIds).toContain(receiverId);
      });
    });

    it('페이지네이션 - 첫 번째 페이지', async () => {
      const result = await repository.findChatRoomsByUserId(receiverId, {
        page: 1,
        limit: 3,
        sortBy: 'updatedAt',
        sortOrder: 'DESC',
      });

      expect(result.items).toHaveLength(3);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(3);
      expect(result.meta.total).toBe(roomsCount);
      expect(result.meta.totalPages).toBe(2); // 5개 / 3 = 2페이지
    });

    it('페이지네이션 - 두 번째 페이지', async () => {
      const result = await repository.findChatRoomsByUserId(receiverId, {
        page: 2,
        limit: 3,
        sortBy: 'updatedAt',
        sortOrder: 'DESC',
      });

      expect(result.items).toHaveLength(2); // 마지막 페이지는 2개
      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(3);
      expect(result.meta.total).toBe(roomsCount);
      expect(result.meta.totalPages).toBe(2);
    });

    it('정렬 - updatedAt DESC (최신순)', async () => {
      const result = await repository.findChatRoomsByUserId(receiverId, {
        page: 1,
        limit: 10,
        sortBy: 'updatedAt',
        sortOrder: 'DESC',
      });

      // 날짜가 내림차순으로 정렬되어 있는지 확인
      for (let i = 0; i < result.items.length - 1; i++) {
        const current = new Date(result.items[i].createdAt).getTime();
        const next = new Date(result.items[i + 1].createdAt).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });

    it('정렬 - updatedAt ASC (오래된순)', async () => {
      const result = await repository.findChatRoomsByUserId(receiverId, {
        page: 1,
        limit: 10,
        sortBy: 'updatedAt',
        sortOrder: 'ASC',
      });

      // 날짜가 오름차순으로 정렬되어 있는지 확인
      for (let i = 0; i < result.items.length - 1; i++) {
        const current = new Date(result.items[i].createdAt).getTime();
        const next = new Date(result.items[i + 1].createdAt).getTime();
        expect(current).toBeLessThanOrEqual(next);
      }
    });

    it('대화방이 없는 사용자는 빈 배열 반환', async () => {
      const nonExistentUserId = 'non-existent-user';
      const result = await repository.findChatRoomsByUserId(nonExistentUserId, {
        page: 1,
        limit: 10,
        sortBy: 'updatedAt',
        sortOrder: 'DESC',
      });

      expect(result.items).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('lastMessage 업데이트 후 정렬 확인', async () => {
      const beforeResult = await repository.findChatRoomsByUserId(receiverId, {
        page: 1,
        limit: 10,
        sortBy: 'updatedAt',
        sortOrder: 'DESC',
      });

      const chatRoomId = beforeResult.items[beforeResult.items.length - 1].id;
      await repository.updateLastMessage(chatRoomId, {
        lastMessage: 'test',
        lastMessageId: 'test-id',
      });

      const afterResult = await repository.findChatRoomsByUserId(receiverId, {
        page: 1,
        limit: 10,
        sortBy: 'updatedAt',
        sortOrder: 'DESC',
      });

      expect(afterResult.items[0].id).toBe(chatRoomId);
    });
  });
});

