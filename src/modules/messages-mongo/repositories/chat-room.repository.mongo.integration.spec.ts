import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AppModule } from '@/app.module';
import { ChatRoomRepositoryMongo } from './chat-room.repository.mongo';

/**
 * ChatRoomsRepositoryMongo 통합 테스트
 */
describe('ChatRoomsRepositoryMongo Integration', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let repository: ChatRoomRepositoryMongo;

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
  }, 30000);

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

    const created = await repository.findOrCreateChatRoom(
      senderId,
      receiverId,
      productId,
    );

    expect(created).toBeDefined();
    expect((created as any)._id).toBeDefined();
    expect(created.productId).toBe(productId);
    expect(Array.isArray(created.participants)).toBe(true);
    expect(created.participants).toHaveLength(2);
    const ids = created.participants.map((p) => p.userId).sort();
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
});
