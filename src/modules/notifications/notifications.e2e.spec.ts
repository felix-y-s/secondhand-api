import { AppModule } from '@/app.module';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import { PrismaService } from '@/prisma/prisma.service';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Notification, NotificationType } from '@prisma/client';
import request from 'supertest';

// function add(a: number, b: number) {
//   return {
//     result: a + b,
//     calculatedAt: new Date().toISOString(),
//   }
// }
// describe('test', () => {
//   it('test', async () => {
//     const output = add(2, 3);
//     expect(output).toMatchSnapshot({
//       calculatedAt: expect.any(String)
//     })
//   })
// })
it('객체 비교 함수 테스트', () => {
  // 원시값 포함 여부
  expect([1, 2, 3]).toContain(1);
  // 객체값 포함 여부
  expect([{ id: 1 }, 2, 3 ]).toContainEqual({ id: 1 });
  // 단일 객체 부분 매칭
  expect({ id: 1, name: 'a' }).toMatchObject({ id: 1 });
  // 부분 객체 매칭 헬퍼
  expect([
    {
      id: 'notification-123',
      userId: 'user-456',
      type: 'NEW_MESSAGE',
      title: '📣 테스트 알림',
      message: '알림 테스트입니다.',
      isRead: false,
      readAt: null,
      createdAt: '2024-01-15T10:30:00Z',
    },
  ]).toContainEqual(
    expect.objectContaining({ id: 'notification-123' }),
    // 나머지 속성은 무시
  );
});

/**
 * Notifications API E2E 테스트
 */
describe('Notifications API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let testUserToken: string;
  let testUserId: string;
  let testNotificationId: string = '';

  const timestamp = Date.now();

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();

    app.useGlobalPipes();
    app.useGlobalGuards();
    app.useGlobalInterceptors(new TransformInterceptor());

    app.setGlobalPrefix('api/v1');

    await app.init();

    prisma = module.get<PrismaService>(PrismaService);

    // 회원가입
    const response = await request(app.getHttpServer())
      .post('/api/v1/users/register')
      .send({
        email: `test-${timestamp}@example.com`,
        password: 'Password123!',
        nickname: `테스트사용자-${timestamp}`,
      });

    testUserToken = response.body.data.accessToken;
    const payload = JSON.parse(
      Buffer.from(testUserToken.split('.')[1], 'base64').toString(),
    );
    testUserId = payload.sub;
  });

  afterAll(async () => {
    try {
      // 테스트 사용자 삭제
      await prisma.user.delete({
        where: { id: testUserId },
      });

      // 테스트 알림 삭제
      if (testNotificationId) {
        await prisma.notification.delete({
          where: { id: testNotificationId },
        });
      }
      await app.close();
    } catch (error) {
      console.error(`❌ 테스트 리소스 정리 중 에러 발생:`, error.message);
    }
  });

  describe('POST /notifications', () => {
    it('알림 생성', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/notifications')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          userId: testUserId,
          type: NotificationType.NEW_MESSAGE,
          title: '📣 테스트 알림',
          message: '알림 테스트입니다.',
        })
        .expect(201); // CREATED

      const body = response.body;
      console.log('🚀 | body:', body);
      expect(body.success).toBeTruthy();
      expect(body.data.id).toBeDefined();
      expect(body.data.title).toBe('📣 테스트 알림');
      expect(body.data.message).toBe('알림 테스트입니다.');
      expect(body.data.userId).toBe(testUserId);
      expect(body.data.isRead).toBeFalsy();
      expect(body.data.readAt).toBeNull();
    });
  });

  describe('내 알림 목록 조회', () => {
    it('내 알림 목록 조회', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);
      expect(response.body.data.items.length).toBeGreaterThan(0);
      expect(response.body.data.totalPages).toBeDefined();
      expect(response.body.data.unreadCount).toBeGreaterThan(0);
    });
  });

  describe('알림 전체 시나리오', () => {
    it('생성 -> 조회 -> 읽음 처리 -> 삭제', async () => {
      const testAgent = request(app.getHttpServer());
      // 1. 알림 생성
      const created = await testAgent
        .post('/api/v1/notifications')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          userId: testUserId,
          type: NotificationType.NEW_MESSAGE,
          title: '📣 테스트 알림',
          message: '알림 테스트입니다.',
        })
        .expect(201);
      const notificationId = created.body.data.id;

      // 2. 생성된 알림이 목록에 있는지 확인
      const list = await testAgent
        .get('/api/v1/notifications?page=1')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);
      // TODO: 어떻게 동작하지?
      expect(list.body.data.items).toContainEqual(
        expect.objectContaining({ id: notificationId }),
      );

      // 3. 읽음 처리
      await testAgent
        .patch(`/api/v1/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      // 4. 읽음 상태 확인
      const updated = await testAgent
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);
      const notification = updated.body.data.items.find(
        (n) => n.id === notificationId,
      );
      expect(notification.isRead).toBe(true);

      // 5. 알림 삭제
      await testAgent
        .delete(`/api/v1/notifications/${notificationId}/delete`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      // 6. 알림 삭제 확인
      const updateList = await testAgent
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);
      const updatedNotification = updateList.body.data.items.find(
        (n) => n.id === notificationId,
      );
      expect(updatedNotification).toBeUndefined();
    });
  });
});
