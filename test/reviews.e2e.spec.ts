import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { OrderStatus, ProductStatus, Role } from '@prisma/client';
import { createTestCompletedOrder } from './helpers/test-data.helper';

/**
 * Reviews API E2E 테스트
 */
describe('Reviews API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let buyerToken: string;
  let sellerToken: string;
  let buyerUserId: string;
  let sellerUserId: string;
  let productId: string;
  let orderId: string;
  let reviewId: string;

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

    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    try {
      // 테스트 데이터 정리
      await prisma.order.deleteMany({});
      await prisma.product.deleteMany({});
      await prisma.category.deleteMany({});
      await prisma.review.deleteMany({});
      await prisma.user.deleteMany({
        where: { email: { contains: 'review-test' } },
      });
    } catch (error) {
      console.log('🚀 | error:', error);
    }
  });

  afterAll(async () => {
    try {
      await prisma.order.deleteMany({});
      await prisma.product.deleteMany({});
      await prisma.category.deleteMany({});
      await prisma.review.deleteMany({});
      await prisma.user.deleteMany({
        where: { email: { contains: 'review-test' } },
      });
    } catch (error) {
      console.log('🚀 | error:', error);
    }
    await app.close();
  });

  describe('사전 준비: 사용자 및 주문 생성', () => {
    it('구매자 사용자 생성', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send({
          email: 'buyer-review-test@example.com',
          password: 'Buyer1234!',
          nickname: '구매자',
          name: '구매자',
        })
        .expect(201);

      buyerToken = response.body.data.accessToken;
      const payload = JSON.parse(
        Buffer.from(buyerToken.split('.')[1], 'base64').toString(),
      );
      buyerUserId = payload.sub;
    });

    it('판매자 사용자 생성 및 SELLER 권한 부여', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send({
          email: 'seller-review-test@example.com',
          password: 'Seller1234!',
          nickname: '판매자',
          name: '판매자',
        })
        .expect(201);

      const payload = JSON.parse(
        Buffer.from(
          response.body.data.accessToken.split('.')[1],
          'base64',
        ).toString(),
      );
      sellerUserId = payload.sub;

      // SELLER 권한 부여
      await prisma.user.update({
        where: { id: sellerUserId },
        data: { role: Role.SELLER },
      });

      // 새 토큰 발급
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/users/login')
        .send({
          email: 'seller-review-test@example.com',
          password: 'Seller1234!',
        })
        .expect(200);

      sellerToken = loginResponse.body.data.accessToken;
    });

    it('카테고리 생성 (관리자 권한)', async () => {
      // 관리자 권한 부여
      await prisma.user.update({
        where: { id: buyerUserId },
        data: { role: Role.ADMIN },
      });

      // 새 토큰 발급
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/users/login')
        .send({
          email: 'buyer-review-test@example.com',
          password: 'Buyer1234!',
        })
        .expect(200);

      const adminToken = loginResponse.body.data.accessToken;

      let category;
      try {
        category = await prisma.category.create({
          data: {
            name: '리뷰 테스트 카테고리',
            slug: 'review-test-category',
          },
        });
      } catch (error) {
        console.log('🚀 | error:', error);
      }

      // 다시 USER 권한으로 변경
      await prisma.user.update({
        where: { id: buyerUserId },
        data: { role: Role.USER },
      });

      // 구매자 토큰 재발급
      const buyerLoginResponse = await request(app.getHttpServer())
        .post('/api/v1/users/login')
        .send({
          email: 'buyer-review-test@example.com',
          password: 'Buyer1234!',
        })
        .expect(200);

      buyerToken = buyerLoginResponse.body.data.accessToken;

      productId = category.id;
    });

    it('상품 생성 (판매자)', async () => {
      const categories = await prisma.category.findMany();
      const categoryId = categories[0].id;

      const response = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          categoryId,
          title: '리뷰 테스트 상품',
          description: '테스트용 상품입니다',
          price: 10000,
          condition: 'GOOD',
        })
        .expect(201);

      productId = response.body.data.id;
    });

    it('주문 생성 및 완료 처리', async () => {
      // 주문 생성
      const orderResponse = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          productId,
          totalAmount: 10000,
        })
        .expect(201);

      orderId = orderResponse.body.data.id;

      // 주문 상태를 CONFIRMED로 변경 (직접 DB 수정)
      await prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CONFIRMED },
      });
    });
  });

  describe('POST /api/v1/reviews - 리뷰 작성', () => {
    it('구매자가 판매자에게 리뷰 작성 성공', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          orderId,
          rating: 5,
          comment: '좋은 거래였습니다. 감사합니다!',
          images: ['https://example.com/review1.jpg'],
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.rating).toBe(5);
      expect(response.body.data.reviewerId).toBe(buyerUserId);
      expect(response.body.data.reviewedId).toBe(sellerUserId);

      reviewId = response.body.data.id;
    });

    it('이미 리뷰가 작성된 주문에 대해 중복 작성 시도 시 실패', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          orderId,
          rating: 4,
          comment: '또 작성',
        })
        .expect(400);
      expect(response.body.message).toContain('이미 리뷰가 작성된 주문입니다');
    });

    it('완료되지 않은 주문에 대한 리뷰 작성 시도 시 실패', async () => {
      // 상품 상태를 INACTIVE로 변경
      await prisma.product.update({
        where: { id: productId },
        data: { status: ProductStatus.ACTIVE },
      });
      // 새 주문 생성
      const orderResponse = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          productId,
          totalAmount: 10000,
        });

      const newOrderId = orderResponse.body.data.id;

      const response = await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          orderId: newOrderId,
          rating: 5,
          comment: '미완료 주문 리뷰',
        })
        .expect(400);

      expect(response.body.message).toContain(
        '완료된 주문에만 리뷰를 작성할 수 있습니다',
      );
    });

    it('평점이 1보다 작으면 실패', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          orderId,
          rating: 0,
        })
        .expect(400);

      expect(response.body.message).toContain('평점은 최소 1점입니다');
    });

    it('평점이 5보다 크면 실패', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          orderId,
          rating: 6,
        })
        .expect(400);

      expect(response.body.message).toContain('평점은 최대 5점입니다');
    });
  });

  describe('GET /api/v1/reviews - 리뷰 목록 조회', () => {
    it('리뷰 목록 조회 성공', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reviews')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reviews).toBeInstanceOf(Array);
      expect(response.body.data.total).toBeGreaterThan(0);
    });

    it('reviewedId 필터링', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reviews')
        .query({ reviewedId: sellerUserId })
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reviews.length).toBeGreaterThan(0);
      expect(response.body.data.reviews[0].reviewedId).toBe(sellerUserId);
    });

    it('최소 평점 필터링', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reviews')
        .query({ minRating: 5 })
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.reviews.forEach((review) => {
        expect(review.rating).toBeGreaterThanOrEqual(5);
      });
    });

    it('페이지네이션 동작', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reviews')
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.limit).toBe(10);
    });
  });

  describe('GET /api/v1/reviews/:id - 리뷰 상세 조회', () => {
    it('리뷰 상세 조회 성공', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(reviewId);
      expect(response.body.data.rating).toBe(5);
    });

    it('존재하지 않는 주문 리뷰 조회 시 실패', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reviews/non-existent-id')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(404);

      expect(response.body.message).toBe('리뷰를 찾을 수 없습니다');
    });
  });

  describe('GET /api/v1/reviews/order/:orderId - 주문별 리뷰 조회', () => {
    it('주문별 리뷰 조회 성공', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/reviews/order/${orderId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.orderId).toBe(orderId);
    });

    it('리뷰가 없는 주문 조회 시 null 반환', async () => {
      // 새 상품 생성
      const categories = await prisma.category.findMany();
      const categoryId = categories[0].id;
      const productResponse = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          categoryId,
          title: '리뷰 테스트 상품2',
          description: '테스트용 상품입니다',
          price: 10000,
          condition: 'GOOD',
        })
        .expect(201);

      const newProductId = productResponse.body.data.id;

      // 새 주문 생성
      const orderResponse = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          productId: newProductId,
          totalAmount: 10000,
        });

      const newOrderId = orderResponse.body.data.id;

      const response = await request(app.getHttpServer())
        .get(`/api/v1/reviews/order/${newOrderId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeNull();
      expect(response.body.message).toContain(
        '리뷰가 아직 작성되지 않았습니다',
      );
    });
  });

  describe('GET /api/v1/reviews/trust/:userId - 신뢰도 점수 조회', () => {
    it('사용자 신뢰도 점수 조회 성공', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/reviews/trust/${sellerUserId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.userId).toBe(sellerUserId);
      expect(response.body.data.trustScore).toBeGreaterThan(0);
      expect(response.body.data.averageRating).toBe(5);
      expect(response.body.data.totalReviews).toBe(1);
      expect(response.body.data.ratingDistribution).toBeDefined();
    });

    it('리뷰가 없는 사용자의 신뢰도 점수는 0', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/reviews/trust/${buyerUserId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.trustScore).toBe(0);
      expect(response.body.data.totalReviews).toBe(0);
    });
  });

  describe('PATCH /api/v1/reviews/:id - 리뷰 수정', () => {
    // 리뷰 생성 전처리
    // beforeEach(async () => {
    //   await createTestCompletedOrder(app, buyerToken, sellerToken, prisma);
    // });

    it('리뷰 작성자가 리뷰 수정 성공', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          rating: 4,
          comment: '수정된 리뷰입니다',
        })
        .expect(200);

      expect(response.body.success).toBe(true); 
      expect(response.body.data.rating).toBe(4);
      expect(response.body.data.comment).toBe('수정된 리뷰입니다');
    });

    it('다른 사용자가 리뷰 수정 시도 시 실패', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          rating: 3,
        })
        .expect(403);

      expect(response.body.message).toContain('리뷰를 수정할 권한이 없습니다');
    });
  });

  describe('DELETE /api/v1/reviews/:id - 리뷰 삭제', () => {
    it('다른 사용자가 리뷰 삭제 시도 시 실패', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(403);

      expect(response.body.message).toContain('리뷰를 삭제할 권한이 없습니다');
    });

    it('리뷰 작성자가 리뷰 삭제 성공', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('리뷰가 삭제되었습니다');
    });

    it('삭제된 리뷰 조회 시 실패', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(404);

    });

    it('삭제 후 판매자 신뢰도 점수가 재계산됨', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/reviews/trust/${sellerUserId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.trustScore).toBe(0);
      expect(response.body.data.totalReviews).toBe(0);
    });
  });
});
