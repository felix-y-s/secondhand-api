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
import { expectResponse, expectUnauthorizedError } from '@/test/assertions/error.assertion';

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

  beforeAll(async () => {
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
    fixture = await MessageDataFixture.create({
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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('MessagesMongoModule E2E 테스트', () => {
    let senderId: string;
    let receiverId: string;
    let productId: string;
    let senderToken: string;
    let receiverToken: string;
    let chatRoomId: string;

    beforeAll(async () => {
      // 테스트 데이터 생성
      const result = await fixture.createAuthenticatedChatRoomContext();
      senderId = result.senderId;
      receiverId = result.receiverId;
      productId = result.productId;
      senderToken = result.senderToken;
      receiverToken = result.receiverToken;
      chatRoomId = result.chatRoomId;
    });

    describe('POST /messages-mongo/chatroom', () => {
      let apiPath: string;
      beforeAll(async () => {
        apiPath = api('/chatroom');
      });

      it('인증 없이 요청 시 401 반환', async () => {
        const res = await request(app.getHttpServer())
          .post(apiPath)
          .expect(401);
        const body = res.body;
        // expect(body.success).toBe(false);
        // expect(body.statusCode).toBe(401);
        // expect(body.error.message).toBe('No auth token');
        // expect(body.error.details).toBe('Unauthorized');
        // expect(body.timestamp).toBeDefined();
        // expect(new Date(body.timestamp)).not.toBe('invalid Date');

        expectUnauthorizedError(body);
      });
      it('필수 필드 누락 시 400 반환', async () => {
        const res = await request(app.getHttpServer())
          .post(apiPath)
          .set('Authorization', `Bearer ${senderToken}`)
          .expect(400);
        const body = res.body;
        expect(body.error).toBe('Bad Request');
        expect(body.message).toHaveLength(2);
        expect(body.message).toContain('receiverId must be a UUID');
        expect(body.message).toContain('productId must be a UUID');
      });
      it('유효한 요청 시 201 반환 및 ChatRoomEntity 형식 검증', async () => {
        const res = await request(app.getHttpServer())
          .post(apiPath)
          .set('Authorization', `Bearer ${senderToken}`)
          .send({ receiverId, productId })
          .expect(201);
        const body = res.body;

        // 응답 래퍼 검증
        // expect(body.success).toBe(true);
        // expect(body.statusCode).toBe(201);
        // expect(body).toHaveProperty('data');
        expectResponse(body);

        // ChatRoomEntity 구조 검증
        const chatRoom = body.data;
        expect(chatRoom).toHaveProperty('id');
        expect(chatRoom).toHaveProperty('productId', productId);
        expect(chatRoom).toHaveProperty('participants');
        expect(chatRoom).toHaveProperty('participantsCount');
        expect(chatRoom).toHaveProperty('createdAt');
        expect(chatRoom).toHaveProperty('updatedAt');

        // participants 배열 검증
        expect(Array.isArray(chatRoom.participants)).toBe(true);
        expect(chatRoom.participants.length).toBeGreaterThan(0);
        expect(chatRoom.participants[0]).toHaveProperty('userId');
        expect(chatRoom.participants[0]).toHaveProperty('joinedAt');
      });
      it('기존 대화방 존재 시 200 반환 및 기존 대화방 반환', async () => {
        const chatFixture = await fixture.createAuthenticatedChatRoomContext();

        const res = await request(app.getHttpServer())
          .post(apiPath)
          .set('Authorization', `Bearer ${chatFixture.senderToken}`)
          .send({
            receiverId: chatFixture.receiverId,
            productId: chatFixture.productId,
          })
          .expect(200);
        const body = res.body;
        expect(body.success).toBe(true);
        expect(body.statusCode).toBe(200);
        expect(body).toHaveProperty('data');
        expect(body.data).toHaveProperty('id', chatFixture.chatRoomId);
      });
    });

    describe('POST /messages-mongo', () => {
      let apiPath: string;
      beforeAll(async () => {
        apiPath = api('/');
      });
      it('인증 없이 요청 시 401 반환', async () => {
        const res = await request(app.getHttpServer())
          .post(apiPath)
          .expect(401);
        const body = res.body;
        expect(body.message).toBe('No auth token');
        expect(body.error).toBe('Unauthorized');
      });
      it('필수 필드 누락 시 400 반환', async () => {
        const res = await request(app.getHttpServer())
          .post(apiPath)
          .set('Authorization', `Bearer ${senderToken}`)
          .expect(400);
        const body = res.body;
        expect(body.message).toContain('대화방 아이디가 누락 되었습니다');
        expect(body.message).toContain('수신인 아이디가 누락 되었습니다');
        expect(body.error).toBe('Bad Request');
        expect(body.statusCode).toBe(400);
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
        const body = res.body;
        expect(body.success).toBe(false);
        expect(body.statusCode).toBe(400);
        expect(body.error.message).toContain(
          '메시지 타입은 다음중 하나여야 합니다. TEXT, IMAGE, SYSTEM',
        );
        expect(body.error.details).toBe('Bad Request');
        expect(body).toHaveProperty('timestamp');
        expect(new Date(body.timestamp).toString()).not.toBe('invalid Date');
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
        const body = res.body;
        expect(body.success).toBe(true);
        expect(body).toHaveProperty('timestamp');
        expect(new Date(body.timestamp).toString()).not.toBe('invalid Date');
      });
    });

    describe('GET /messages-mongo/chatroom/:roomId/messages', () => {
      it('인증 없이 요청 시 401 반환', async () => {});
      it('잘못된 쿼리 파라미터 시 400 반환', async () => {});
      it('유효한 요청 시 200 반환 및 PaginatedResult 형식 검증', async () => {});
      // ↑ 여기서 페이지네이션, 정렬 모두 검증
    });

    describe('PATCH /messages-mongo/chatrooms/:roomId/read', () => {
      it('인증 없이 요청 시 401 반환', async () => {});
      it('유효한 요청 시 200 반환 및 modifiedCount 포함 확인', async () => {});
    });

    describe('GET /messages-mongo/chatrooms/:roomId/unread-count', () => {
      it('인증 없이 요청 시 401 반환', async () => {});
      it('유효한 요청 시 200 반환 및 unreadCount 포함 확인', async () => {});
    });

    describe('DELETE /messages-mongo/chatrooms/:roomId/leave', () => {
      it('인증 없이 요청 시 401 반환', async () => {});
      it('유효한 요청 시 200 반환', async () => {});
      // ❌ "마지막 사용자 나가면 삭제" 제거 (통합 테스트 항목)
    });

    // 2. 실제 사용자 시나리오
    describe('실제 사용자 시나리오', () => {
      it('전체 플로우: 대화방 생성 → 메시지 전송 → 조회 → 읽음 처리', async () => {});
      it('두 사용자 대화: A 전송 → B 조회 및 읽음 처리', async () => {});
    });

    // 3. 동시성 테스트
    // describe('동시성 테스트', () => {
    //   it('여러 사용자가 동시에 메시지 전송 시 모두 성공', async () => {
    //     // Given: 대화방과 여러 사용자

    //     // When: 10명의 사용자가 동시에 메시지 전송
    //     const promises = users.map((user) =>
    //       request(app.getHttpServer())
    //         .post('/messages')
    //         .set('Authorization', user.token)
    //         .send({ chatRoomId, receiverId, content: 'test' }),
    //     );

    //     const results = await Promise.all(promises);

    //     // Then: 모든 요청이 201 성공
    //     results.forEach((res) => expect(res.status).toBe(201));

    //     // Then: 데이터베이스에 10개 메시지 모두 저장됨
    //     const messages = await getMessages(chatRoomId);
    //     expect(messages).toHaveLength(10);
    //   });
    //   it('동시에 여러 사용자가 읽음 처리 시 정확한 카운트 유지', async () => {
    //     // Given: 여러 대화방에 안읽은 메시지

    //     // When: 여러 사용자가 동시에 읽음 처리
    //     const promises = users.map((user) =>
    //       request(app.getHttpServer())
    //         .put('/messages/read')
    //         .set('Authorization', user.token)
    //         .send({ chatRoomId: user.chatRoomId }),
    //     );

    //     await Promise.all(promises);

    //     // Then: 각 사용자의 안읽은 메시지 수가 0
    //     for (const user of users) {
    //       const count = await getUnreadCount(user.chatRoomId, user.id);
    //       expect(count).toBe(0);
    //     }
    //   });
    // });

    // 4. 응답 형식 통일성
    describe('응답 형식 통일성', () => {
      it('모든 4xx 에러가 일관된 형식 (statusCode, message, error)', async () => {});
      it('ValidationPipe 에러가 필드별 상세 정보 포함', async () => {});
    });
  });

  describe('❌ 사용자 시나리오', () => {
    let senderId: string;
    let receiverId: string;
    let productId: string;
    let senderToken: string;
    let receiverToken: string;

    beforeAll(async () => {
      // 테스트 데이터 생성
      const result = await fixture.createAuthenticatedChatTestContext();
      senderId = result.senderId;
      receiverId = result.receiverId;
      productId = result.productId;
      senderToken = result.senderToken;
      receiverToken = result.receiverToken;
    });

    it('신규 채팅 플로우', async () => {
      // 1. 대화방 생성
      const createRoomPath = api('/chatroom');
      const newRoomResult = await request(app.getHttpServer())
        .post(createRoomPath)
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          receiverId,
          productId,
        })
        .expect(201);
      const newRoom: ChatRoomEntity = newRoomResult.body?.data;
      const chatroomId = newRoom.id;

      // 2. 메시지 전송
      const sendMessagePath = api('/');
      const sendMessageResult = await request(app.getHttpServer())
        .post(sendMessagePath)
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          chatroomId,
          receiverId,
          content: '테스트 메시지',
          messageType: MessageType.TEXT,
        })
        .expect(201);
      expect(sendMessageResult.body?.success).toBeTruthy();

      // 3. 메시지 안 읽음 카운트 조회
      const nureadCountPath = api(`chatrooms/${chatroomId}/unread-count`);
      const readCountResult = await request(app.getHttpServer())
        .get(nureadCountPath)
        .set('Authorization', `Bearer ${receiverToken}`)
        .expect(200);
      expect(readCountResult.body?.success).toBeTruthy();
      expect(readCountResult.body?.data?.unreadCount).toBe(1);

      // 4. 메시지 읽음 처리
      const markMessageAsReadPath = api(`chatrooms/${chatroomId}/read`);
      const readedResult = await request(app.getHttpServer())
        .patch(markMessageAsReadPath)
        .set('Authorization', `Bearer ${receiverToken}`)
        .expect(200);

      expect(readedResult.body?.success).toBeTruthy();
      expect(readedResult.body?.data?.modifiedCount).toBe(1);

      // 5. 대화방 나가기
      const leaveRoomPath = api(`chatrooms/${newRoom.id}/leave`);
      const leaveRoomResult = await request(app.getHttpServer())
        .delete(leaveRoomPath)
        .set('Authorization', `Bearer ${receiverToken}`)
        .expect(200);
      expect(leaveRoomResult.body?.success).toBeTruthy();

      // 5-1. 대화방 사용자 확인
      const afterRoomsInfo = await chatRoomModel.find({
        _id: chatroomId,
      });
      expect(afterRoomsInfo[0].participantsCount).toBe(1);

      // 6. 대화방 삭제
      const leaveRoomResult2 = await request(app.getHttpServer())
        .delete(leaveRoomPath)
        .set('Authorization', `Bearer ${senderToken}`)
        .expect(200);
      expect(leaveRoomResult2.body?.success).toBeTruthy();

      // 6-1. 대화방 삭제 확인
      const afterRoomsInfo2 = await chatRoomModel.find({
        _id: newRoom.id,
      });
      expect(afterRoomsInfo2.length).toBe(0);

      // 6-2. 대화방에 속한 메시지 삭제 확인
      const messageResult = await messageModel.find({
        conversationId: chatroomId,
      });
      expect(messageResult.length).toBe(0);
    });
    it('기존 채팅 재진입 플로우', () => {});
  });
});
