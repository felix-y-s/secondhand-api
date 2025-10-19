import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { ProductStatus, ProductCondition } from '@prisma/client';

/**
 * Product API E2E 테스트
 */
describe('Products API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let userId: string;
  let productId: string;
  let categoryId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Validation Pipe 설정 (앱과 동일하게)
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

    // 전역 prefix 설정
    app.setGlobalPrefix('api/v1');

    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // 테스트 데이터 정리
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'product-test' } },
    });
  });

  afterAll(async () => {
    // 테스트 데이터 정리
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'product-test' } },
    });

    await app.close();
  });

  describe('사전 준비: 사용자 및 카테고리 생성', () => {
    it('사용자 등록 및 로그인', async () => {
      // 사용자 등록
      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send({
          email: 'product-test@example.com',
          password: 'Test1234!',
          nickname: '상품테스터',
          name: '테스트유저',
        })
        .expect(201);

      expect(registerResponse.body.success).toBe(true);
      expect(registerResponse.body.data.accessToken).toBeDefined();

      accessToken = registerResponse.body.data.accessToken;

      // JWT 디코딩하여 userId 추출
      const payload = JSON.parse(
        Buffer.from(accessToken.split('.')[1], 'base64').toString(),
      );
      userId = payload.sub;

      expect(userId).toBeDefined();
    });

    it('카테고리 생성', async () => {
      // 직접 DB에 카테고리 생성 (Category API가 아직 없으므로)
      const category = await prisma.category.create({
        data: {
          name: '전자기기',
          slug: 'electronics',
        },
      });

      categoryId = category.id;
      expect(categoryId).toBeDefined();
    });
  });

  describe('POST /api/v1/products - 상품 등록', () => {
    it('성공: 상품 등록', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'iPhone 13 Pro 256GB',
          description: '작년에 구매한 iPhone 13 Pro입니다. 거의 새것입니다.',
          price: 850000,
          categoryId: categoryId,
          condition: ProductCondition.LIKE_NEW,
          images: [
            'https://example.com/image1.jpg',
            'https://example.com/image2.jpg',
          ],
          latitude: 37.5665,
          longitude: 126.978,
          location: '서울시 강남구',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.title).toBe('iPhone 13 Pro 256GB');
      expect(response.body.data.price).toBe(850000);
      expect(response.body.data.status).toBe(ProductStatus.ACTIVE);
      expect(response.body.data.sellerId).toBe(userId);

      productId = response.body.data.id;
    });

    it('실패: 인증 없이 상품 등록', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/products')
        .send({
          title: 'Test Product',
          description: 'Test Description',
          price: 10000,
          categoryId: categoryId,
          condition: ProductCondition.GOOD,
        })
        .expect(401);
    });

    it('실패: 필수 필드 누락', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Test Product',
          // description 누락
          price: 10000,
          categoryId: categoryId,
          condition: ProductCondition.GOOD,
        })
        .expect(400);
    });

    it('실패: 잘못된 가격 (음수)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Test Product',
          description: 'Test Description',
          price: -1000, // 음수 가격
          categoryId: categoryId,
          condition: ProductCondition.GOOD,
        })
        .expect(400);
    });

    it('실패: 위도만 제공 (경도 누락)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Test Product',
          description: 'Test Description',
          price: 10000,
          categoryId: categoryId,
          condition: ProductCondition.GOOD,
          latitude: 37.5665,
          // longitude 누락
        })
        .expect(400);
    });
  });

  describe('GET /api/v1/products/:id - 상품 상세 조회', () => {
    it('성공: 상품 상세 조회 (Public)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/products/${productId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(productId);
      expect(response.body.data.title).toBe('iPhone 13 Pro 256GB');
      expect(response.body.data.seller).toBeDefined();
      expect(response.body.data.seller.nickname).toBe('상품테스터');
      expect(response.body.data.category).toBeDefined();
      expect(response.body.data.category.name).toBe('전자기기');
    });

    it('실패: 존재하지 않는 상품 조회', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/products/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('조회수 증가 확인', async () => {
      // 첫 번째 조회
      const response1 = await request(app.getHttpServer())
        .get(`/api/v1/products/${productId}`)
        .expect(200);

      const initialViewCount = response1.body.data.viewCount;

      // 두 번째 조회
      await request(app.getHttpServer())
        .get(`/api/v1/products/${productId}`)
        .expect(200);

      // 잠시 대기 (비동기 조회수 증가 처리)
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 세 번째 조회로 증가된 조회수 확인
      const response3 = await request(app.getHttpServer())
        .get(`/api/v1/products/${productId}`)
        .expect(200);

      expect(response3.body.data.viewCount).toBeGreaterThan(initialViewCount);
    });
  });

  describe('GET /api/v1/products - 상품 목록 조회', () => {
    beforeAll(async () => {
      // 추가 테스트 상품 생성
      await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'MacBook Pro 2023',
          description: 'MacBook Pro 14인치 M3',
          price: 2500000,
          categoryId: categoryId,
          condition: ProductCondition.NEW,
        });

      await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'iPad Air 2024',
          description: 'iPad Air 5세대',
          price: 750000,
          categoryId: categoryId,
          condition: ProductCondition.LIKE_NEW,
        });
    });

    it('성공: 전체 상품 목록 조회 (Public)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeInstanceOf(Array);
      expect(response.body.data.items.length).toBeGreaterThan(0);
      expect(response.body.data.total).toBeGreaterThan(0);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.limit).toBe(20);
    });

    it('성공: 페이지네이션', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products?page=1&limit=2')
        .expect(200);

      expect(response.body.data.items.length).toBeLessThanOrEqual(2);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.limit).toBe(2);
    });
  });

  describe('GET /api/v1/products/search - 상품 검색', () => {
    it('성공: 키워드 검색', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products/search?keyword=iPhone')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeInstanceOf(Array);
      expect(response.body.data.items.length).toBeGreaterThan(0);
      expect(
        response.body.data.items[0].title.toLowerCase().includes('iphone') ||
          response.body.data.items[0].description
            .toLowerCase()
            .includes('iphone'),
      ).toBe(true);
    });

    it('성공: 가격대 검색', async () => {
      // 가격 범위로 검색 - API가 정상적으로 응답하는지 확인
      const response = await request(app.getHttpServer())
        .get('/api/v1/products/search?keyword=iPhone&minPrice=500000&maxPrice=1000000')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('page');
      expect(response.body.data).toHaveProperty('limit');
    });

    it('성공: 카테고리 검색', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/products/search?categoryId=${categoryId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.items.forEach((item: any) => {
        expect(item.categoryId).toBe(categoryId);
      });
    });

    it('성공: 복합 검색 (키워드 + 가격대 + 카테고리)', async () => {
      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/products/search?keyword=Pro&minPrice=500000&categoryId=${categoryId}`,
        )
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/products/me - 내 상품 목록', () => {
    it('성공: 내 상품 목록 조회', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/products/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeInstanceOf(Array);
      expect(response.body.data.items.length).toBeGreaterThan(0);
      response.body.data.items.forEach((item: any) => {
        expect(item.sellerId).toBe(userId);
      });
    });

    it('실패: 인증 없이 조회', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/products/me')
        .expect(401);
    });
  });

  describe('PATCH /api/v1/products/:id - 상품 수정', () => {
    it('성공: 상품 정보 수정', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'iPhone 13 Pro 256GB (가격인하)',
          price: 800000,
          status: ProductStatus.ACTIVE,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('iPhone 13 Pro 256GB (가격인하)');
      expect(response.body.data.price).toBe(800000);
    });

    it('실패: 인증 없이 수정', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/products/${productId}`)
        .send({
          title: 'Updated Title',
        })
        .expect(401);
    });

    it('실패: 다른 사용자의 상품 수정', async () => {
      // 다른 사용자 생성 및 로그인
      const otherUserResponse = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send({
          email: 'product-test-other@example.com',
          password: 'Test1234!',
          nickname: '다른사용자',
        })
        .expect(201);

      const otherUserToken = otherUserResponse.body.data.accessToken;

      await request(app.getHttpServer())
        .patch(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({
          title: 'Hacked Title',
        })
        .expect(403);
    });

    it('실패: 존재하지 않는 상품 수정', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/products/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Updated Title',
        })
        .expect(404);
    });
  });

  describe('DELETE /api/v1/products/:id - 상품 삭제', () => {
    let deleteProductId: string;

    beforeAll(async () => {
      // 삭제 테스트용 상품 생성
      const response = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: '삭제 테스트 상품',
          description: '삭제될 상품입니다',
          price: 10000,
          categoryId: categoryId,
          condition: ProductCondition.GOOD,
        })
        .expect(201);

      deleteProductId = response.body.data.id;
    });

    it('성공: 상품 삭제 (소프트 삭제)', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/products/${deleteProductId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(ProductStatus.DELETED);
    });

    it('실패: 인증 없이 삭제', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/products/${productId}`)
        .expect(401);
    });

    it('실패: 이미 삭제된 상품 재삭제', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/products/${deleteProductId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('실패: 존재하지 않는 상품 삭제', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/products/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });
});
