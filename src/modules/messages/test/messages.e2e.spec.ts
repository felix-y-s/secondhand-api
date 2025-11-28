import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HttpExceptionFilter } from '@/common/filters';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/**
 * Message API E2E 테스트
 */
describe('MessagesController', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let eventEmitter: EventEmitter2;

  let testCategoryId: string;
  let testSellerId: string;
  let testSellerEmail: string;
  let testBuyerEmail: string;
  let testProductId: string;
  let accessToken: string;
  let testPassword = 'Password123!';
  let loginUserId: string;
  let chatRoomId: string;

  /**
   * 헬퍼 함수: 사용자 로그인
   */
  async function loginUser(email: string, password: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/users/login')
      .send({ email, password });

    if (!response.body.success) {
      throw new Error(`로그인 실패: ${email}`);
    }

    const payload = JSON.parse(
      Buffer.from(
        response.body.data.accessToken.split('.')[1],
        'base64',
      ).toString(),
    );

    return {
      accessToken: response.body.data.accessToken,
      userId: payload.sub,
    };
  }

  async function initTest() {
    const timestamp = Date.now();
    // 카테고리 생성
    const category = await prisma.category.create({
      data: {
        name: `테스트 카테고리-${timestamp}`,
        slug: `test-category-${timestamp}`,
        icon: '📦',
        order: 0,
      },
    });
    testCategoryId = category.id;

    // 상품 생성
    const product = await prisma.product.create({
      data: {
        sellerId: testSellerId,
        categoryId: testCategoryId,
        title: '테스트 상품',
        description: '테스트용 상품입니다.',
        condition: 'GOOD',
        price: 10000,
        images: ['https://example.com/image.jpg'],
        latitude: 37.5665,
        longitude: 126.978,
        location: '서울시 강남구',
      },
    });
    testProductId = product.id;
  }
  async function uninitTest() {
    // 채팅방 및 메시지 먼저 삭제 (외래 키 제약 조건)
    await prisma.chatMessage.deleteMany({
      where: {
        chatRoom: {
          productId: testProductId,
        },
      },
    });

    await prisma.chatRoomMember.deleteMany({
      where: {
        chatRoom: {
          productId: testProductId,
        },
      },
    });

    await prisma.chatRoom.deleteMany({
      where: {
        productId: testProductId,
      },
    });

    // 상품 삭제
    await prisma.product.deleteMany({
      where: {
        categoryId: testCategoryId,
      },
    });

    // 카테고리 삭제
    await prisma.category.delete({
      where: {
        id: testCategoryId,
      },
    });

    // 사용자 삭제
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [testSellerId, loginUserId],
        },
      },
    });
  }

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();

    // Global Prefix 설정 (main.ts와 동일하게)
    app.setGlobalPrefix('api/v1', {
      exclude: ['health', 'api-docs'],
    });

    // Global Validation Pipe 설정
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    app.useGlobalInterceptors(new TransformInterceptor());

    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    eventEmitter = app.get<EventEmitter2>(EventEmitter2);

    const timestamp = Date.now();
    testSellerEmail = `seller_${timestamp}@test.com`;
    testBuyerEmail = `buyer_${timestamp}@test.com`;

    // 사용자 생성
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    // 판매자 생성
    const seller = await prisma.user.create({
      data: {
        email: testSellerEmail,
        password: hashedPassword,
        name: '테스트판매자',
        nickname: `seller_${Date.now()}`,
        role: Role.SELLER,
      },
    });
    testSellerId = seller.id;

    // 구매자 생성
    const buyer = await prisma.user.create({
      data: {
        email: testBuyerEmail,
        password: hashedPassword,
        name: '테스트구매자',
        nickname: `buyer_${Date.now()}`,
        role: Role.USER,
      },
    });
    loginUserId = buyer.id;

    // 테스트 사용자 로그인
    const loginData = await loginUser(testBuyerEmail, testPassword);
    accessToken = loginData.accessToken;
    // loginUserId는 이미 설정됨

    await initTest();
  });

  afterAll(async () => {
    await uninitTest();

    // 앱 종료 (Redis 연결 포함 모든 리소스 정리)
    await app.close();

    // Jest 타이머 정리 (비동기 작업 완료 대기)
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  describe('대화방 생성', () => {
    let existingRoomId: string;

    it('새로운 대화방 생성', async () => {
      // 이벤트 리스너 등록을 Promise로 래핑 (5초 타임아웃)
      const eventPromise = new Promise<{
        chatRoomId: string;
        productId: string;
        buyerId: string;
        sellerId: string;
      }>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new Error(
              '이벤트 타임아웃: chatroom.created 이벤트가 5초 내에 발행되지 않음',
            ),
          );
        }, 5000);

        eventEmitter.once('chatroom.created', (payload) => {
          clearTimeout(timeout);
          resolve(payload);
        });
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/messages/chatrooms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          productId: testProductId,
        })
        .expect(201);

      existingRoomId = response.body.data.id;

      const userIds = response.body.data.members.map((member) => member.userId);
      expect(response.body.success).toBe(true);
      expect(userIds).toContain(loginUserId);

      // chatroom.created 이벤트가 발행되었는지 확인
      const eventPayload = await eventPromise;
      expect(eventPayload).toBeDefined();
      expect(eventPayload.chatRoomId).toBe(response.body.data.id);
      expect(eventPayload.productId).toBe(testProductId);
      expect(eventPayload.buyerId).toBe(loginUserId);
      expect(eventPayload.sellerId).toBe(testSellerId);
    });
    it('기존 대화방 조회', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/messages/chatrooms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          productId: testProductId,
        })
        .expect(201);

      const userIds = response.body.data.members.map((member) => member.userId);
      const productId = response.body.data.productId;
      expect(productId).toBe(testProductId);
      expect(userIds).toContain(loginUserId);
      // 동일한 대화방인지 확인
      expect(response.body.data.id).toBe(existingRoomId);
    });
    it('본인 상품은 채팅방 생성 금지', async () => {
      // 판매자로 로그인
      const { accessToken: sellerAccessToken } = await loginUser(
        testSellerEmail,
        testPassword,
      );

      // 본인 상품에 대화방 생성 시도
      const response = await request(app.getHttpServer())
        .post('/api/v1/messages/chatrooms')
        .set('Authorization', `Bearer ${sellerAccessToken}`)
        .send({
          productId: testProductId,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe(
        '본인 상품에는 채팅할 수 없습니다.',
      );
    });

    it('삭제된 상품은 대화방 생성 금지', async () => {
      // 테스트용 삭제 상태 상품 생성
      const deletedProduct = await prisma.product.create({
        data: {
          sellerId: testSellerId,
          categoryId: testCategoryId,
          title: '삭제된 상품',
          description: '삭제된 테스트 상품',
          condition: 'GOOD',
          price: 5000,
          images: ['https://example.com/deleted.jpg'],
          latitude: 37.5665,
          longitude: 126.978,
          location: '서울시 강남구',
          status: 'DELETED',
        },
      });

      // 삭제된 상품에 대화방 생성 시도
      const response = await request(app.getHttpServer())
        .post('/api/v1/messages/chatrooms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          productId: deletedProduct.id,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('삭제된 대화방 조회 시도');

      // 테스트용 상품 삭제
      await prisma.product.delete({
        where: { id: deletedProduct.id },
      });
    });
  });

  describe('내 채팅방 목록 조회', () => {
    let unreadChatRoomId: string;

    it('조회 성공', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/messages/chatrooms`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);

      chatRoomId = response.body.data[0].chatRoomId;
      expect(response.body.data[0].userId).toBe(loginUserId);
      expect(response.body.data[0].unreadCount).toBeDefined();
      expect(chatRoomId).toBeDefined();
    });

    it('메시지 전송', async () => {
      const timestamp = new Date().toISOString();
      const testContent = `테스트 메시지-${timestamp}`;

      const response = await request(app.getHttpServer())
        .post(`/api/v1/messages`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          chatRoomId,
          content: testContent,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.content).toBe(testContent);
      expect(response.body.data.chatRoomId).toBe(chatRoomId);
      expect(response.body.data.senderId).toBe(loginUserId);
      expect(response.body.data.isRead).toBe(false);
    });

    it('메시지 조회 성공', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/messages/chatrooms/${chatRoomId}/messages`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBeInstanceOf(Array);
      expect(response.body.data.message.length).toBeGreaterThan(0);

      const unreadMessage = response.body.data.message.find(
        (msg) => msg.isRead === false,
      );
      expect(unreadMessage).toBeDefined();
      unreadChatRoomId = unreadMessage.chatRoomId;
    });

    it('읽음 처리', async () => {
      // 판매자로 로그인
      const { accessToken: sellerAccessToken } = await loginUser(
        testSellerEmail,
        testPassword,
      );

      // 읽음 처리
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/messages/chatrooms/${unreadChatRoomId}/read`)
        .set('Authorization', `Bearer ${sellerAccessToken}`)
        .expect(200);
      expect(response.body.success).toBeTruthy();

      // 읽음 처리한 메시지 업데이트 확인
      const msgs = await prisma.chatMessage.findMany({
        where: {
          chatRoomId: unreadChatRoomId,
          senderId: { not: loginUserId },
        },
      });
      const isRead = msgs.some((msg) => msg.isRead === false);
      expect(isRead).toBe(false);
    });

    it('채팅방 나가기', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/messages/chatrooms/${unreadChatRoomId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBeTruthy();
    });
  });
});
