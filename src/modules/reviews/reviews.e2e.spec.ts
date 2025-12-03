import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import {
  TestDataFactory,
  TestReviewDataFactory,
} from '@/test/fixtures/test-data.factory';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';

/**
 * Reviews API E2E 테스트
 */
describe('Reviews API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let configService: ConfigService;
  let testReviewDataFactory: TestReviewDataFactory;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

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

    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);
    configService = app.get<ConfigService>(ConfigService);

    const testDataFactory = new TestDataFactory(
      prisma,
      configService,
      jwtService,
    );
    testReviewDataFactory = await TestReviewDataFactory.create(
      testDataFactory,
      prisma,
    );
  });

  afterAll(async () => {
    await testReviewDataFactory.cleanupAll();
    await app.close();
  });

  describe('리뷰 편집', () => {
    describe('POST /api/v1/reviews - 리뷰 작성', () => {
      it('구매자가 판매자에게 리뷰 작성 성공', async () => {
        // Given: 📝 리뷰 가능한 테스트 주문 만들기
        const { reviewer, reviewee, order } =
          await testReviewDataFactory.createReviewableOrder();

        // When: 🧪 리뷰 작성 API 요청 실행
        const res = await request(app.getHttpServer())
          .post('/api/v1/reviews')
          .set('Authorization', `Bearer ${reviewer.token}`)
          .send({
            orderId: order.id,
            rating: 5,
            comment: '좋은 거래였습니다. 감사합니다!',
            images: ['https://example.com/review1.jpg'],
          })
          .expect(201);
        const body = res.body;

        expect(body.success).toBe(true);
        expect(body.data.id).toBeDefined();
        expect(body.data.rating).toBe(5);
        expect(body.data.reviewerId).toBe(reviewer.id);
        expect(body.data.reviewedId).toBe(reviewee.id);
      });

      it('이미 리뷰가 작성된 주문에 대해 중복 작성 시도 시 실패', async () => {
        // Given: 📝 이미 리뷰 작성된 주문 만들기
        const { reviewer, reviewee, order } =
          await testReviewDataFactory.createReviewedOrder();

        // When: 🧪 리뷰 작성 API 요청 실행
        const response = await request(app.getHttpServer())
          .post('/api/v1/reviews')
          .set('Authorization', `Bearer ${reviewer.token}`)
          .send({
            orderId: order.id,
            rating: 4,
            comment: '또 작성',
          })
          .expect(400);
        expect(response.body.message).toContain(
          '이미 리뷰가 작성된 주문입니다',
        );
      });

      it('완료되지 않은 주문에 대한 리뷰 작성 시도 시 실패', async () => {
        // 📝 완료되지 않은 주문 생성
        const { reviewer, reviewee, order } =
          await testReviewDataFactory.createUncompletedOrder();

        // When: 🧪 리뷰 작성 API 요청 실행
        const response = await request(app.getHttpServer())
          .post('/api/v1/reviews')
          .set('Authorization', `Bearer ${reviewer.token}`)
          .send({
            orderId: order.id,
            rating: 5,
            comment: '미완료 주문 리뷰',
          })
          .expect(400);

        expect(response.body.message).toContain(
          '완료된 주문에만 리뷰를 작성할 수 있습니다',
        );
      });

      it('평점이 1보다 작으면 실패', async () => {
        // Given: 📝 리뷰 가능한 테스트 주문 만들기
        const { reviewer, reviewee, order } =
          await testReviewDataFactory.createReviewableOrder();

        // When: 🧪 리뷰 작성 API 요청 실행
        const response = await request(app.getHttpServer())
          .post('/api/v1/reviews')
          .set('Authorization', `Bearer ${reviewer.token}`)
          .send({
            orderId: order.id,
            rating: 0,
          })
          .expect(400);

        expect(response.body.message).toContain('평점은 최소 1점입니다');
      });

      it('평점이 5보다 크면 실패', async () => {
        // Given: 📝 리뷰 가능한 테스트 주문 만들기
        const { reviewer, reviewee, order } =
          await testReviewDataFactory.createReviewableOrder();

        // When: 🧪 리뷰 작성 API 요청 실행
        const response = await request(app.getHttpServer())
          .post('/api/v1/reviews')
          .set('Authorization', `Bearer ${reviewer.token}`)
          .send({
            orderId: order.id,
            rating: 6,
          })
          .expect(400);

        expect(response.body.message).toContain('평점은 최대 5점입니다');
      });
    });
    describe('PATCH /api/v1/reviews/:id - 리뷰 수정', () => {
      let reviewer, reviewee;
      let reviewId: string;
      beforeEach(async () => {
        // 📝 수정 가능한 리뷰 생성 (각 테스트마다 독립적인 데이터 제공)
        let reviews;
        ({ reviewer, reviewee, reviews } =
          await testReviewDataFactory.createReviewerWithReviews(1));
        reviewId = reviews[0].id;
      });
      it('리뷰 작성자가 리뷰 수정 성공', async () => {
        const res = await request(app.getHttpServer())
          .patch(`/api/v1/reviews/${reviewId}`)
          .set('Authorization', `Bearer ${reviewer.token}`)
          .send({
            rating: 4,
            comment: '수정된 리뷰입니다',
          })
          .expect(200);

        const body = res.body;
        expect(body.success).toBe(true);
        expect(body.data.rating).toBe(4);
        expect(body.data.comment).toBe('수정된 리뷰입니다');
      });

      it('다른 사용자가 리뷰 수정 시도 시 실패', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/api/v1/reviews/${reviewId}`)
          .set('Authorization', `Bearer ${reviewee.token}`)
          .send({
            rating: 3,
          })
          .expect(403);

        expect(response.body.message).toContain(
          '리뷰를 수정할 권한이 없습니다',
        );
      });
    });

    describe('DELETE /api/v1/reviews/:id - 리뷰 삭제', () => {
      let reviewer, reviewee, reviews;
      beforeEach(async () => {
        // 📝 삭제 테스트용 리뷰 생성 (각 테스트마다 독립적인 데이터 제공)
        ({ reviewer, reviewee, reviews } =
          await testReviewDataFactory.createReviewerWithReviews(5));
      });
      it('다른 사용자가 리뷰 삭제 시도 시 실패', async () => {
        const reviewId = reviews[0].id;

        // 🧪 When: 리뷰 삭제 api 실행
        const response = await request(app.getHttpServer())
          .delete(`/api/v1/reviews/${reviewId}`)
          .set('Authorization', `Bearer ${reviewee.token}`)
          .expect(403);

        expect(response.body.message).toContain(
          '리뷰를 삭제할 권한이 없습니다',
        );
      });

      it('리뷰 작성자가 리뷰 삭제 성공', async () => {
        const reviewId = reviews[0].id;

        // 🧪 When: 리뷰 삭제 api 실행
        const response = await request(app.getHttpServer())
          .delete(`/api/v1/reviews/${reviewId}`)
          .set('Authorization', `Bearer ${reviewer.token}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('리뷰가 삭제되었습니다');
      });

      it('삭제된 리뷰 조회 시 실패', async () => {
        // 📝 Given: 리뷰 삭제
        const deletedReviewId = reviews[1].id;
        await testReviewDataFactory.deleteReview(deletedReviewId);

        // 🧪 When: 리뷰 조회 api 실행
        const response = await request(app.getHttpServer())
          .get(`/api/v1/reviews/${deletedReviewId}`)
          .set('Authorization', `Bearer ${reviewer.token}`)
          .expect(404);
      });

      it('삭제 후 판매자 신뢰도 점수가 재계산됨', async () => {
        // 📝 Given: 리뷰 삭제 전 신뢰도 조회
        const beforeRes = await request(app.getHttpServer())
          .get(`/api/v1/reviews/trust/${reviewee.id}`)
          .set('Authorization', `Bearer ${reviewer.token}`)
          .expect(200);
        const beforeTrustScore = beforeRes.body.data.trustScore;
        const beforeTotalReviews = beforeRes.body.data.totalReviews;

        // 리뷰 삭제
        const deletedReviewId = reviews[2].id;
        await testReviewDataFactory.deleteReview(deletedReviewId);

        // 🧪 When: 신뢰도 조회 api 실행
        const res = await request(app.getHttpServer())
          .get(`/api/v1/reviews/trust/${reviewee.id}`)
          .set('Authorization', `Bearer ${reviewer.token}`)
          .expect(200);

        const body = res.body;
        expect(body.success).toBe(true);
        expect(body.data.trustScore).not.toEqual(beforeTrustScore);
        expect(body.data.totalReviews).toBe(beforeTotalReviews - 1);
      });
    });
  });

  describe('리뷰 조회', () => {
    let reviewer: any;
    let reviewee: any;
    let reviews: Array<any>;
    let orders: Array<any>;
    let limit = 10;
    const reviewCount = 15;
    beforeAll(async () => {
      // 📝 리뷰 가능한 테스트 주문 만들기
      ({ reviewer, reviewee, reviews, orders } =
        await testReviewDataFactory.createReviewerWithReviews(reviewCount));
    });

    describe('GET /api/v1/reviews/user/:userId - 사용자별 리뷰 목록 조회', () => {
      it('사용자별 리뷰 목록 조회 성공', async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/reviews/user?reviewerId=${reviewer.id}&limit=${limit}`)
          .set('Authorization', `Bearer ${reviewer.token}`)
          .expect(200);
        const body = res.body;

        expect(body.success).toBe(true);
        expect(body.data.reviews).toBeInstanceOf(Array);
        expect(body.data.reviews).toHaveLength(
          reviewCount > limit ? limit : reviewCount,
        );
      });

      it('최소 평점 필터링', async () => {
        const minRating = 3;
        const response = await request(app.getHttpServer())
          .get(`/api/v1/reviews/user?reviewerId=${reviewer.id}`)
          .query({ minRating })
          .set('Authorization', `Bearer ${reviewer.token}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        response.body.data.reviews.forEach((review) => {
          expect(review.rating).toBeGreaterThanOrEqual(minRating);
        });
      });

      it('페이지네이션 동작', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/v1/reviews/user?reviewerId=${reviewer.id}`)
          .query({ page: 1, limit: 10 })
          .set('Authorization', `Bearer ${reviewer.token}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.page).toBe(1);
        expect(response.body.data.limit).toBe(10);
      });
    });
    describe('GET /api/v1/reviews/received - 내가 받은 리뷰 조회', () => {
      it('내가 받은 리뷰 조회 성공', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/reviews/received')
          .set('Authorization', `Bearer ${reviewee.token}`)
          .expect(200);
        const body = res.body;

        expect(body.success).toBe(true);
        expect(body.data.reviews).toBeInstanceOf(Array);
        expect(body.data.total).toBeGreaterThan(0);
        // 판매자가 받은 리뷰 확인
        body.data.reviews.forEach((review: any) => {
          expect(review.reviewedId).toBe(reviewee.id);
        });
      });

      it('리뷰를 받지 않은 사용자는 빈 배열 반환', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/reviews/received')
          .set('Authorization', `Bearer ${reviewer.token}`)
          .expect(200);
        const body = res.body;

        expect(body.success).toBe(true);
        expect(body.data.reviews).toEqual([]);
        expect(body.data.total).toBe(0);
      });
    });
    describe('GET /api/v1/reviews/given - 내가 작성한 리뷰 조회', () => {
      it('내가 작성한 리뷰 조회 성공', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/reviews/given')
          .set('Authorization', `Bearer ${reviewer.token}`)
          .expect(200);
        const body = res.body;

        expect(body.success).toBe(true);
        expect(body.data.reviews).toBeInstanceOf(Array);
        expect(body.data.total).toBeGreaterThan(0);
        // 구매자가 작성한 리뷰 확인
        body.data.reviews.forEach((review) => {
          expect(review.reviewerId).toBe(reviewer.id);
        });
      });

      it('리뷰를 작성하지 않은 사용자는 빈 배열 반환', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/reviews/given')
          .set('Authorization', `Bearer ${reviewee.token}`)
          .expect(200);

        const body = res.body;
        expect(body.success).toBe(true);
        expect(body.data.reviews).toEqual([]);
        expect(body.data.total).toBe(0);
      });
    });
    describe('GET /api/v1/reviews/:id - 리뷰 상세 조회', () => {
      it('리뷰 상세 조회 성공', async () => {
        const reviewId = reviews[0].id;
        const res = await request(app.getHttpServer())
          .get(`/api/v1/reviews/${reviewId}`)
          .set('Authorization', `Bearer ${reviewer.token}`)
          .expect(200);
        const body = res.body;

        expect(body.success).toBe(true);
        expect(body.data.id).toBe(reviewId);
        expect(body.data.rating).toBeDefined();
      });

      it('존재하지 않는 주문 리뷰 조회 시 실패', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/reviews/non-existent-id')
          .set('Authorization', `Bearer ${reviewer.token}`)
          .expect(404);

        expect(res.body.message).toBe('리뷰를 찾을 수 없습니다');
      });
    });

    describe('GET /api/v1/reviews/order/:orderId - 주문별 리뷰 조회', () => {
      it('주문별 리뷰 조회 성공', async () => {
        const orderId = orders[0].id;
        const res = await request(app.getHttpServer())
          .get(`/api/v1/reviews/order/${orderId}`)
          .set('Authorization', `Bearer ${reviewer.token}`)
          .expect(200);
        const body = res.body;

        expect(body.success).toBe(true);
        expect(body.data).toBeDefined();
        expect(body.data.orderId).toBe(orderId);
      });

      it('리뷰가 없는 주문 조회 시 null 반환', async () => {
        // 📝 Given: 리뷰가 없는 주문 생성
        const { reviewer, order } =
          await testReviewDataFactory.createReviewableOrder();

        // 🧪 When: 리뷰 조회 api 실행
        const res = await request(app.getHttpServer())
          .get(`/api/v1/reviews/order/${order.id}`)
          .set('Authorization', `Bearer ${reviewer.token}`)
          .expect(200);

        const body = res.body;
        expect(body.success).toBe(true);
        expect(body.data).toBeNull();
        expect(body.message).toContain('리뷰가 아직 작성되지 않았습니다');
      });
    });

    describe('GET /api/v1/reviews/trust/:userId - 신뢰도 점수 조회', () => {
      it('사용자 신뢰도 점수 조회 성공', async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/reviews/trust/${reviewee.id}`)
          .set('Authorization', `Bearer ${reviewer.token}`)
          .expect(200);
        const body = res.body;

        expect(body.success).toBe(true);
        expect(body.data.userId).toBe(reviewee.id);
        expect(body.data.trustScore).toBeGreaterThan(0);
        expect(body.data.averageRating).toBeDefined();
        expect(body.data.totalReviews).toBe(reviews.length);
        expect(body.data.ratingDistribution).toBeDefined();
      });

      it('리뷰가 없는 사용자의 신뢰도 점수는 0', async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/reviews/trust/${reviewer.id}`)
          .set('Authorization', `Bearer ${reviewee.token}`)
          .expect(200);

        const body = res.body;
        expect(body.success).toBe(true);
        expect(body.data.trustScore).toBe(0);
        expect(body.data.totalReviews).toBe(0);
      });
    });
  });
});
