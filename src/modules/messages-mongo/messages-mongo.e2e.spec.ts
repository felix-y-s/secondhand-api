import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import request from 'supertest';
import { ChatRoom, Message } from './schemas';
import { MessageDataFixture } from './__tests__/message-data.fixture';
import { getApiPath } from '@/test/helpers/api.helper';
import { ChatRoomEntity } from './domain/entities/chat-room.entity';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import { MessageType } from './domain/enums/message-type.enum';
import { HttpExceptionFilter } from '@/common/filters';
import {
  expectBadRequestError,
  expectUnauthorizedError,
} from '@/test/assertions/error.assertion';
import {
  expectCreatedResponse,
  expectPaginatedResult,
  expectSuccessResponse,
} from '@/test/assertions';
import { MessageEntity } from './domain/entities/message.entity';
import { SendMessageDto } from './dto/send-message.dto';
import { MongodbService } from '@/database/mongodb/mongodb.service';

/**
 * E2E 테스트 범위
 *
 * 1. 각 API 엔드포인트별 HTTP 레이어 검증
 *    - 인증 실패 (401 Unauthorized)
 *    - DTO 검증 실패 (400 Bad Request)
 *    - 성공 케이스 (200/201 + 응답 형식)
 *
 * 2. 실제 사용자 시나리오
 *    - 여러 API를 조합한 완전한 플로우
 *
 * 3. 동시성 테스트
 *    - 여러 사용자의 동시 요청 처리
 *    - 데이터 일관성 검증
 *
 * 4. 응답 형식 통일성
 *    - 에러 응답 일관성
 *    - ValidationPipe 에러 형식
 *
 * ❌ E2E에서 제외 (통합 테스트에서 검증)
 *    - 비즈니스 로직 예외 (403, 404)
 *    - 복잡한 엣지 케이스
 *    - 데이터 무결성 검증
 */
describe('MessagesMongoController E2E 테스트', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let prismaService: PrismaService;
  let configService: ConfigService;
  let jwtService: JwtService;
  let apiBasePath: string;
  let fixture: MessageDataFixture;
  let chatRoomModel;
  let messageModel;
  let api;

  // chatRoom 구조 확인 헬퍼
  function expectValidChatRoomEntity(chatRoom: ChatRoomEntity): void {
    // ChatRoomEntity 구조 검증
    expect(chatRoom).toHaveProperty('id');
    expect(chatRoom).toHaveProperty('productId');
    expect(chatRoom).toHaveProperty('participants');
    expect(chatRoom).toHaveProperty('participantsCount');
    expect(chatRoom).toHaveProperty('createdAt');
    expect(chatRoom).toHaveProperty('updatedAt');

    // participants 배열 검증
    const participants = chatRoom.participants;
    expect(Array.isArray(participants)).toBe(true);
    expect(participants.length).toBeGreaterThan(0);
    expect(participants[0]).toHaveProperty('userId');
    expect(participants[0]).toHaveProperty('joinedAt');
    expect(participants[0]).toHaveProperty('leftAt');
  }

  // message 구조 확인 헬퍼
  function expectValidMessageEntity(message: MessageEntity): void {
    expect(message).toHaveProperty('id');
    expect(message).toHaveProperty('conversationId');
    expect(message).toHaveProperty('senderId');
    expect(message).toHaveProperty('receiverId');
    expect(message).toHaveProperty('message');
    expect(message).toHaveProperty('messageType');
    expect(message).toHaveProperty('readAt');
    // expect(message).toHaveProperty('fileUrl');
    // expect(message).toHaveProperty('fileName');
    expect(message).toHaveProperty('createdAt');
    expect(message).toHaveProperty('updatedAt');
  }

  beforeAll(async () => {
    // 프로세스 레벨 에러 핸들러 (E2E 테스트용)
    process.on('uncaughtException', (error: Error) => {
      console.error('🚨 [E2E Test - Uncaught Exception]', error.message);
      console.error('Stack:', error.stack);
    });

    process.on('unhandledRejection', (reason: any) => {
      console.error('🚨 [E2E Test - Unhandled Rejection]', reason);
    });

    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    prismaService = app.get<PrismaService>(PrismaService);
    configService = app.get<ConfigService>(ConfigService);
    jwtService = app.get<JwtService>(JwtService);

    // 테스트 데이터 팩토리 생성
    chatRoomModel = app.get<Model<ChatRoom>>(getModelToken(ChatRoom.name));
    messageModel = app.get<Model<Message>>(getModelToken(Message.name));
    fixture = new MessageDataFixture({
      prismaService,
      configService,
      jwtService,
      chatRoomModel,
      messageModel,
    });

    apiBasePath = configService.getOrThrow<string>('app.apiBasePath');
    api = getApiPath(apiBasePath, 'messages-mongo');
    app.setGlobalPrefix(apiBasePath);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true, // 미정의 속성 제거
        forbidNonWhitelisted: true, // 미정의 속성으로 인한 요청 거부
        transform: true, // DTO 타입 변환
        transformOptions: {
          // DTO 타입 변환 옵션
          enableImplicitConversion: true,
        },
      }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();

    // HTTP 서버 네트워크 에러 핸들링 (ECONNRESET 등 TCP 소켓 에러 캡처)
    const httpServer = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Api Endpoints 테스트', () => {
    let senderId: string;
    let receiverId: string;
    let productId: string;
    let senderToken: string;
    let receiverToken: string;
    let apiPath: string;

    beforeAll(async () => {
      // 테스트 데이터 생성
      const result = await fixture.createAuthenticatedChatTestContext();
      senderId = result.senderId;
      receiverId = result.receiverId;
      productId = result.productId;
      senderToken = result.senderToken;
      receiverToken = result.receiverToken;
    });

    describe('POST /messages-mongo/chatroom - 대화방 생성/조회', () => {
      beforeAll(async () => {
        apiPath = api('/chatroom');
      });

      it('인증 없이 요청 시 401 반환', async () => {
        const res = await request(app.getHttpServer())
          .post(apiPath)
          .expect(401);
        const body = res.body;

        expectUnauthorizedError(body, 'No auth token');
      });
      it('필수 필드 누락 시 400 반환', async () => {
        const res = await request(app.getHttpServer())
          .post(apiPath)
          .set('Authorization', `Bearer ${senderToken}`)
          .expect(400);

        expectBadRequestError(res.body, [
          'receiverId must be a UUID',
          'productId must be a UUID',
        ]);
      });
      it('유효한 요청 시 201 반환 및 ChatRoomEntity 형식 검증', async () => {
        const res = await request(app.getHttpServer())
          .post(apiPath)
          .set('Authorization', `Bearer ${senderToken}`)
          .send({ receiverId, productId })
          .expect(201);

        // 응답 래퍼 검증
        expectCreatedResponse<ChatRoomEntity>(
          res.body,
          expectValidChatRoomEntity,
        );
      });
      it('기존 대화방 존재 시 200 반환 및 기존 대화방 반환', async () => {
        await fixture.createChatRoomFixture(senderId, receiverId, productId);

        const res = await request(app.getHttpServer())
          .post(apiPath)
          .set('Authorization', `Bearer ${senderToken}`)
          .send({
            receiverId: receiverId,
            productId: productId,
          })
          .expect(200);

        expectSuccessResponse<ChatRoomEntity>(
          res.body,
          expectValidChatRoomEntity,
          200,
        );
      });
    });

    describe('POST /messages-mongo - 메시지 전송', () => {
      let apiPath: string;
      let chatRoomId: string;
      beforeAll(async () => {
        apiPath = api('/');
        const chatRoom = await fixture.createChatRoomFixture(
          senderId,
          receiverId,
          productId,
        );
        chatRoomId = chatRoom.id;
      });

      it('인증 없이 요청 시 401 반환', async () => {
        const res = await request(app.getHttpServer())
          .post(apiPath)
          .expect(401);
        expectUnauthorizedError(res.body, 'No auth token');
      });
      it('필수 필드 누락 시 400 반환', async () => {
        const res = await request(app.getHttpServer())
          .post(apiPath)
          .set('Authorization', `Bearer ${senderToken}`)
          .expect(400);
        expectBadRequestError(res.body, [
          'chatRoomId must be a string',
          '대화방 아이디가 누락 되었습니다',
          'receiverId must be a UUID',
          '수신인 아이디가 누락 되었습니다',
        ]);
      });
      it('잘못된 messageType으로 요청 시 400 반환', async () => {
        const res = await request(app.getHttpServer())
          .post(apiPath)
          .set('Authorization', `Bearer ${senderToken}`)
          .send({
            chatRoomId,
            receiverId,
            content: '메시지 발송 테스트',
            messageType: 'not-exist-type',
          })
          .expect(400);

        expectBadRequestError(res.body, [
          '메시지 타입은 다음중 하나여야 합니다. TEXT, IMAGE, SYSTEM',
        ]);
      });
      it('유효한 요청 시 201 반환', async () => {
        const res = await request(app.getHttpServer())
          .post(apiPath)
          .set('Authorization', `Bearer ${senderToken}`)
          .send({
            chatRoomId,
            receiverId,
            content: '메시지 발송 테스트',
            messageType: MessageType.TEXT,
          })
          .expect(201);
        expectCreatedResponse(res.body);
      });
    });

    describe('GET /messages-mongo/chatroom/:roomId/messages - 메시지 목록 조회', () => {
      let apiPath: string;
      let chatRoomId: string;
      const messageCount = 2;

      beforeAll(async () => {
        const { chatRoom } = await fixture.createChatRoomWithMessagesFixture(
          senderId,
          receiverId,
          productId,
          { messageCount },
        );
        chatRoomId = chatRoom.id;
        apiPath = api(`/chatroom/${chatRoomId}/messages`);
      });
      it('인증 없이 요청 시 401 반환', async () => {
        const res = await request(app.getHttpServer()).get(apiPath).expect(401);
        expectUnauthorizedError(res.body, 'No auth token');
      });

      it('유효한 요청 시 200 반환 및 PaginatedResult 형식 검증', async () => {
        // When: 메시지 목록 조회
        const res = await request(app.getHttpServer())
          .get(apiPath)
          .set('Authorization', `Bearer ${senderToken}`)
          .expect(200);

        // Then: 페이지네이션 응답 검증
        expectSuccessResponse(res.body, (paginationData) =>
          expectPaginatedResult<MessageEntity>(
            paginationData,
            messageCount,
            (message) => expectValidMessageEntity(message),
            {
              page: 1,
              limit: 10,
              total: messageCount,
              totalPages: 1,
            },
          ),
        );
      });
    });

    describe('PATCH /messages-mongo/chatroom/:roomId/read - 메시지 읽음 처리', () => {
      let chatRoomId: string;
      let apiPath: string;
      const messageCount = 2;
      beforeAll(async () => {
        const { chatRoom } = await fixture.createChatRoomWithMessagesFixture(
          senderId,
          receiverId,
          productId,
          { messageCount },
        );
        chatRoomId = chatRoom.id;
        apiPath = api(`chatroom/${chatRoomId}/read`);
      });

      it('인증 없이 요청 시 401 반환', async () => {
        const res = await request(app.getHttpServer())
          .patch(apiPath)
          .expect(401);
        expectUnauthorizedError(res.body, 'No auth token');
      });
      it('유효한 요청 시 200 반환 및 modifiedCount 포함 확인', async () => {
        const res = await request(app.getHttpServer())
          .patch(apiPath)
          .set('Authorization', `Bearer ${receiverToken}`)
          .expect(200);
        expectSuccessResponse(res.body, (data) => {
          expect(data).toHaveProperty('modifiedCount');
          expect(data.modifiedCount).toBeGreaterThan(0);
        });
      });
    });

    describe('GET /messages-mongo/chatroom/:roomId/unread-count - 읽지 않은 메시지 수 조회', () => {
      let apiPath: string;
      let chatRoomId: string;
      const messageCount = 2;
      beforeAll(async () => {
        // Given: 대화방 생성 및 메시지 생성
        const { chatRoom } = await fixture.createChatRoomWithMessagesFixture(
          senderId,
          receiverId,
          productId,
          { messageCount },
        );
        chatRoomId = chatRoom.id;
        apiPath = api(`chatroom/${chatRoomId}/unread-count`);
      });
      afterAll(async () => {
        // 테스트 후 대화방 삭제
        await fixture.deleteChatRoomFixture(chatRoomId);
        // 테스트 후 메시지 삭제
        await fixture.deleteMessageFixture(chatRoomId);
      });

      it('인증 없이 요청 시 (401)', async () => {
        const res = await request(app.getHttpServer()).get(apiPath).expect(401);
        expectUnauthorizedError(res.body, 'No auth token');
      });
      it('유효한 요청 시 (200), unreadCount 포함 확인', async () => {
        const res = await request(app.getHttpServer())
          .get(apiPath)
          .set('Authorization', `Bearer ${receiverToken}`)
          .expect(200);
        expectSuccessResponse(res.body, (data) => {
          expect(data).toHaveProperty('unreadCount', messageCount);
        });
      });
    });

    describe('DELETE /messages-mongo/chatroom/:roomId/leave - 대화방 나가기', () => {
      let chatRoomId: string;
      let leaveApiPath: string;
      beforeAll(async () => {
        // Given: 대화방 생성 및 메시지 생성
        const result = await fixture.createChatRoomWithMessagesFixture(
          senderId,
          receiverId,
          productId,
        );
        chatRoomId = result.chatRoom.id;
        // Given: API Path 설정
        leaveApiPath = api(`chatroom/${chatRoomId}/leave`);
      });
      it('인증 없이 요청 시 401 반환', async () => {
        const res = await request(app.getHttpServer())
          .delete(leaveApiPath)
          .expect(401);
        expectUnauthorizedError(res.body, 'No auth token');
      });
      it('유효한 요청 시 200 반환', async () => {
        const res = await request(app.getHttpServer())
          .delete(leaveApiPath)
          .set('Authorization', `Bearer ${receiverToken}`)
          .expect(200);
        expectSuccessResponse(res.body);
      });
      // ❌ "마지막 사용자 나가면 삭제" 제거 (통합 테스트 항목)
    });
  });

  // 2. 실제 사용자 시나리오
  describe('실제 사용자 시나리오', () => {
    let sellerId: string;
    let sellerToken: string;
    let buyerId: string;
    let buyerToken: string;
    let productId: string;

    beforeAll(async () => {
      const context = await fixture.createAuthenticatedChatTestContext();
      sellerId = context.senderId;
      sellerToken = context.senderToken;
      buyerId = context.receiverId;
      buyerToken = context.receiverToken;
      productId = context.productId;
    });

    describe('채팅 전체 플로우 (Happy Path)', () => {
      let chatRoomId: string;

      afterEach(async () => {
        await fixture.deleteChatRoomFixture(chatRoomId);
        await fixture.deleteMessageFixture(chatRoomId);
      });

      it('구매자가 판매자에게 메시지를 보내고 대화하는 기본 흐름', async () => {
        // ✅ E2E 목적: API 호출 순서와 연결이 올바른지 검증
        // 대화방 생성 -> 메시지 전송 -> 메시지 조회 -> 읽음 처리 -> 대화방 나가기

        // 1. 구매자가 대화방 생성
        const createApiPath = api('/chatroom');
        const createRes = await request(app.getHttpServer())
          .post(createApiPath)
          .set('Authorization', `Bearer ${buyerToken}`)
          .send({
            receiverId: sellerId,
            productId,
          })
          .expect(201);
        const body = createRes.body;
        chatRoomId = body.data.id;

        // 2. 구매자가 첫 메시지 전송
        const sendApiPath = api(``);
        await request(app.getHttpServer())
          .post(sendApiPath)
          .set('Authorization', `Bearer ${buyerToken}`)
          .send({
            content: '안녕하세요, 이 상품 아직 판매 중인가요?',
            messageType: MessageType.TEXT,
            receiverId: sellerId,
            chatRoomId,
          } as SendMessageDto)
          .expect(201);

        // 3. 판매자의 안읽은 메시지 카운트 증가 확인
        const unreadCountApiPath = api(`/chatroom/${chatRoomId}/unread-count`);
        const unreadCountRes = await request(app.getHttpServer())
          .get(unreadCountApiPath)
          .set('Authorization', `Bearer ${sellerToken}`)
          .expect(200);
        expectSuccessResponse(unreadCountRes.body, (data) => {
          expect(data.unreadCount).toBe(1);
        });

        // 5. 판매자가 메시지 목록 조회 (새 메시지 확인)
        const getMessageApiPath = api(`/chatroom/${chatRoomId}/messages`);
        const getMessageRes = await request(app.getHttpServer())
          .get(getMessageApiPath)
          .set('Authorization', `Bearer ${sellerToken}`)
          .expect(200);
        expectSuccessResponse(getMessageRes.body, (data) => {
          expect(data.items[0].message).toBe(
            '안녕하세요, 이 상품 아직 판매 중인가요?',
          );
        });

        // 6. 판매자가 읽음 처리
        const markReadApiPath = api(`/chatroom/${chatRoomId}/read`);
        await request(app.getHttpServer())
          .patch(markReadApiPath)
          .set('Authorization', `Bearer ${sellerToken}`)
          .expect(200);

        // 7. 판매자가 답장
        await request(app.getHttpServer())
          .post(sendApiPath)
          .set('Authorization', `Bearer ${sellerToken}`)
          .send({
            content: '네, 아직 판매 중입니다.',
            messageType: MessageType.TEXT,
            receiverId: buyerId,
            chatRoomId,
          } as SendMessageDto)
          .expect(201);

        // 8. 구매자가 메시지 확인
        const buyerGetMessageRes = await request(app.getHttpServer())
          .get(getMessageApiPath)
          .set('Authorization', `Bearer ${buyerToken}`)
          .expect(200);
        expectSuccessResponse(buyerGetMessageRes.body, (data) => {
          expect(data.items[0].message).toBe('네, 아직 판매 중입니다.');
        });

        // 9. 구매자가 읽음 처리
        await request(app.getHttpServer())
          .patch(markReadApiPath)
          .set('Authorization', `Bearer ${buyerToken}`)
          .expect(200);

        // 10. 구매자의 안읽은 메시지 카운트 감소 확인
        const buyerUnreadCountRes = await request(app.getHttpServer())
          .get(unreadCountApiPath)
          .set('Authorization', `Bearer ${buyerToken}`)
          .expect(200);
        expectSuccessResponse(buyerUnreadCountRes.body, (data) => {
          expect(data.unreadCount).toBe(0);
        });

        // 11. 대화방 나가기
        const leaveApiPath = api(`/chatroom/${chatRoomId}/leave`);
        await request(app.getHttpServer())
          .delete(leaveApiPath)
          .set('Authorization', `Bearer ${buyerToken}`)
          .expect(200);
      });
    });
    describe('여러 대화방 관리', () => {
      const userCount = 3;
      let buyers: { userId: string; token: string }[];
      userCount;
      beforeAll(async () => {
        // 테스트 구매자 3명 배열 만들기
        buyers = await fixture.createUsersForChatRoomTest(userCount);
      });

      it('판매자가 여러 구매자와 대화할 수 있음 (API 연결 검증)', async () => {
        // ✅ E2E 목적: 여러 대화방 생성 → 목록 조회 API 연결 확인

        // 1. 3명의 각 구매자가 대화방 생성하고 메시지 전송
        const createRoomApiPath = api('/chatroom');
        const promises = buyers.map(async ({ token }) => {
          return request(app.getHttpServer())
            .post(createRoomApiPath)
            .set('Authorization', `Bearer ${token}`)
            .send({
              receiverId: sellerId,
              productId,
            })
            .then((res) => ({
              chatRoomId: res.body.data.id,
              buyerToken: token,
            }));
        });
        const responses = await Promise.all(promises);
        const chatRoomIds = new Set(responses.map((res) => res.chatRoomId));
        expect(chatRoomIds.size).toBe(buyers.length);

        // 2. 각 대화방에 메시지 전송
        const sendApiPath = api('');
        const sendPromises = responses.map(({ chatRoomId, buyerToken }) => {
          return request(app.getHttpServer())
            .post(sendApiPath)
            .set('Authorization', `Bearer ${buyerToken}`)
            .send({
              chatRoomId,
              receiverId: sellerId,
              content: '안녕하세요',
              messageType: MessageType.TEXT,
            } as SendMessageDto)
            .then((res) => res.body);
        });
        const sendResults = await Promise.all(sendPromises);
        expect(sendResults.every((res) => res.statusCode === 201)).toBe(true);

        // 3. 판매자가 모든 대화방 목록 조회
        const chatRoomListApi = api('/chatRoom/list');
        const chatRoomListResult = await request(app.getHttpServer())
          .get(chatRoomListApi)
          .set('Authorization', `Bearer ${sellerToken}`)
          .expect(200);
        expectSuccessResponse(chatRoomListResult.body, (data) => {
          expectPaginatedResult<ChatRoom>(
            data,
            buyers.length,
            (item) => {
              expect(item.productId).toBe(productId);
            },
            {
              page: 1,
              limit: 10,
              total: buyers.length,
              totalPages: Math.ceil(buyers.length / 10),
            },
          );
        });
      });
    });
    describe('메시지 전송 후 상태 전파', () => {
      const userCount = 3;
      let buyers: { userId: string; token: string }[];
      beforeAll(async () => {
        // 테스트 구매자 3명 배열 만들기
        buyers = await fixture.createUsersForChatRoomTest(userCount);
      });

      it('메시지 전송 -> 대화방 목록에 반영됨', async () => {
        // ✅ E2E 목적: 메시지 생성 API가 대화방 목록 API에 영향을 주는지 확인

        // Given: 구매자별 대화방 생성
        await Promise.all(
          buyers.map(({ userId: senderId }) =>
            request(app.getHttpServer())
              .post(api('/chatroom'))
              .set('Authorization', `Bearer ${sellerToken}`)
              .send({
                receiverId: senderId,
                productId,
              }),
          ),
        );

        // 1️⃣ 대화방 목록 조회
        const beforeResult = await request(app.getHttpServer())
          .get(api('/chatRoom/list'))
          .set('Authorization', `Bearer ${sellerToken}`)
          .expect(200);
        const lastChatRoomId =
          beforeResult.body.data.items[buyers.length - 1].id;

        // 2️⃣ 마지막 대화방에 메시지 전송
        await request(app.getHttpServer())
          .post(api(''))
          .set('Authorization', `Bearer ${sellerToken}`)
          .send({
            chatRoomId: lastChatRoomId,
            receiverId: buyerId,
            content: '안녕하세요',
            messageType: MessageType.TEXT,
          })
          .expect(201);

        // 3️⃣ 대화방 목록 조회 - 마지막 대화방이 제일 위에
        const afterResult = await request(app.getHttpServer())
          .get(api('/chatRoom/list'))
          .set('Authorization', `Bearer ${sellerToken}`)
          .expect(200);
        expect(afterResult.body.data.items[0].id).toBe(lastChatRoomId);
      });
    });
  });

  // 3. 동시성 테스트
  describe('동시성 테스트', () => {
    let concurrentRequestCount = 5;
    let contexts = new Array<{
      senderId: string;
      senderToken: string;
      receiverId: string;
      receiverToken: string;
      productId: string;
      chatRoomId: string;
    }>();
    beforeAll(async () => {
      // 테스트 수신인, 발신인, 대화방 배열 만들기
      // 동시성 테스트를 위해 5명의 사용자로 테스트 (너무 많으면 ECONNRESET 발생)
      const promises = Array.from({ length: concurrentRequestCount }).map(() =>
        fixture.createAuthenticatedChatRoomContext(),
      );
      const results = await Promise.all(promises);
      contexts.push(...results);
    });

    afterAll(async () => {
      // 테스트 데이터 정리
      await Promise.all(
        contexts.map(async (content) => {
          await fixture.deleteMessageFixture(content.chatRoomId);
          await fixture.deleteChatRoomFixture(content.chatRoomId);
        }),
      );
    });

    it('여러 사용자가 동시에 메시지 전송 시 모두 성공', async () => {
      // Given: 대화방과 여러 사용자
      const sendApiPath = api('');

      // When: 5명의 사용자가 동시에 메시지 전송
      const promises = contexts.map((content) =>
        request(app.getHttpServer())
          .post(sendApiPath)
          .set('Authorization', `Bearer ${content.senderToken}`)
          .send({
            chatRoomId: content.chatRoomId,
            receiverId: content.receiverId,
            content: 'test',
            messageType: MessageType.TEXT,
          }),
      );

      const results = await Promise.all(promises);

      // Then: 모든 요청이 201 성공
      results.forEach((res) => expect(res.status).toBe(201));

      // Then: 데이터베이스에 5개 메시지 모두 저장됨
      const messages = await Promise.all(
        contexts.map((content) => {
          return messageModel.findOne({
            conversationId: content.chatRoomId,
            senderId: content.senderId,
            receiverId: content.receiverId,
          });
        }),
      );
      expect(messages).toHaveLength(concurrentRequestCount);
      expect(messages.every((msg) => msg !== null)).toBe(true);
    });

    it('동시에 여러 사용자가 읽음 처리 시 정확한 카운트 유지', async () => {
      // Given: 여러 대화방에 안읽은 메시지 생성 (Staggered Requests)
      const sendApiPath = api('');
      const startTime = Date.now();

      // 각 요청을 순차적으로 시작하되 완료는 기다리지 않음
      const sendPromises = contexts.map((content, index) => {
        return request(app.getHttpServer())
          .post(sendApiPath)
          .set('Authorization', `Bearer ${content.senderToken}`)
          .send({
            chatRoomId: content.chatRoomId,
            receiverId: content.receiverId,
            content: '읽지 않은 메시지',
            messageType: MessageType.TEXT,
          });
      });

      const sendResults = await Promise.all(sendPromises);

      // When: 여러 사용자가 동시에 읽음 처리 (Staggered Requests)
      const markReadPromises = contexts.map((content) => {
        const markReadApiPath = api(`chatroom/${content.chatRoomId}/read`);
        return request(app.getHttpServer())
          .patch(markReadApiPath)
          .set('Authorization', `Bearer ${content.receiverToken}`);
      });

      await Promise.all(markReadPromises);

      // Then: 각 사용자의 안읽은 메시지 수가 0 (Staggered Requests)
      const unreadCountPromises = contexts.map((content) => {
        const unreadCountApiPath = api(
          `chatroom/${content.chatRoomId}/unread-count`,
        );
        return request(app.getHttpServer())
          .get(unreadCountApiPath)
          .set('Authorization', `Bearer ${content.receiverToken}`)
          .then((res) => res.body.data.unreadCount);
      });

      const unreadCounts = await Promise.all(unreadCountPromises);

      unreadCounts.forEach((count) => expect(count).toBe(0));
    });
  });

  // 4. 응답 형식 통일성
  // describe('응답 형식 통일성', () => {
  //   it('모든 4xx 에러가 일관된 형식 (statusCode, message, error)', async () => {});
  //   it('ValidationPipe 에러가 필드별 상세 정보 포함', async () => {});
  // });
});
