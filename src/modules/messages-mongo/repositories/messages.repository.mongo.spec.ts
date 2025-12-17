import { AppModule } from '@/app.module';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import { AuthModule } from '@/modules/auth/auth.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { PrismaService } from '@/prisma/prisma.service';
import { TestDataFactory } from '@/test/fixtures/test-data.factory';
import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

/**
 * MessageRepositoryMongo e2e 테스트
 */
describe('MessageRepositoryMongo e2e 테스트', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let prisma: PrismaService;
  let testDataFactory: TestDataFactory;

  beforeAll(async () => {
    // MongoDB Memory Server 시작 (최대 30초 대기)
    mongod = await MongoMemoryServer.create();
    const mongoUrl = mongod.getUri();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule, PrismaModule, AuthModule, ConfigModule],
      // providers: [PrismaService],
    })
      .overrideProvider('MONGODB_URI')
      .useValue(mongoUrl)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', {
      exclude: ['health', 'api-docs'],
    });
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    const configService = app.get<ConfigService>(ConfigService);
    const jwtService = app.get<JwtService>(JwtService);

    testDataFactory = new TestDataFactory(prisma, configService, jwtService);

    const ops = configService.get('jwt.secret');
  }, 30000); // 30초 타임아웃

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

  describe('POST /api/v1/messages - 메시지 전송', () => {
    let seller, buyer;
    beforeAll(async () => {
      ({ seller, buyer } = await testDataFactory.createSellerAndBuyer());
    })
    it('메시지 전송', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/messages-mongo')
        .set('Authorization', `Bearer ${buyer.token}`)
        .send({
          receiverId: seller.id,
          content: '안녕하세요',
          messageType: 'text',
        });
    });
  });
});
