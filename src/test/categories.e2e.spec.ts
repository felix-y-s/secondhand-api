import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { Role } from '@prisma/client';

/**
 * Categories API E2E 테스트
 */
describe('Categories API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let userToken: string;
  let adminUserId: string;
  let categoryId: string;
  let childCategoryId: string;

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
    await prisma.category.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'category-test' } },
    });
  });

  afterAll(async () => {
    // 테스트 데이터 정리
    await prisma.category.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'category-test' } },
    });

    await app.close();
  });

  describe('사전 준비: 사용자 생성', () => {
    it('관리자 사용자 등록 및 로그인', async () => {
      // 관리자 사용자 등록
      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send({
          email: 'admin-category-test@example.com',
          password: 'Admin1234!',
          nickname: '관리자',
          name: '관리자',
        })
        .expect(201);

      expect(registerResponse.body.success).toBe(true);
      expect(registerResponse.body.data.accessToken).toBeDefined();

      adminToken = registerResponse.body.data.accessToken;

      // JWT 디코딩하여 userId 추출
      const payload = JSON.parse(
        Buffer.from(adminToken.split('.')[1], 'base64').toString(),
      );
      adminUserId = payload.sub;

      // 관리자 권한 부여 (직접 DB 수정)
      await prisma.user.update({
        where: { id: adminUserId },
        data: { role: Role.ADMIN },
      });

      // 권한 업데이트 후 다시 로그인하여 새 토큰 발급
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/users/login')
        .send({
          email: 'admin-category-test@example.com',
          password: 'Admin1234!',
        })
        .expect(200);

      adminToken = loginResponse.body.data.accessToken;
      expect(adminUserId).toBeDefined();
    });

    it('일반 사용자 등록 및 로그인', async () => {
      // 일반 사용자 등록
      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send({
          email: 'user-category-test@example.com',
          password: 'User1234!',
          nickname: '일반사용자',
          name: '일반사용자',
        })
        .expect(201);

      expect(registerResponse.body.success).toBe(true);
      expect(registerResponse.body.data.accessToken).toBeDefined();

      userToken = registerResponse.body.data.accessToken;
    });
  });

  describe('POST /api/v1/categories - 카테고리 생성', () => {
    it('성공: 관리자가 새 카테고리 생성', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '전자기기',
          slug: 'electronics',
          icon: 'https://example.com/icons/electronics.svg',
          order: 0,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('전자기기');
      expect(response.body.data.slug).toBe('electronics');
      expect(response.body.data.isActive).toBe(true);

      categoryId = response.body.data.id;
    });

    it('성공: 하위 카테고리 생성', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '노트북',
          slug: 'laptops',
          parentId: categoryId,
          order: 0,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('노트북');
      expect(response.body.data.parentId).toBe(categoryId);
      expect(response.body.data.parent.name).toBe('전자기기');

      childCategoryId = response.body.data.id;
    });

    it('실패: 인증 없이 카테고리 생성', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/categories')
        .send({
          name: '의류',
          slug: 'clothing',
        })
        .expect(401);
    });

    it('실패: 일반 사용자가 카테고리 생성', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: '가구',
          slug: 'furniture',
        })
        .expect(403);
    });

    it('실패: 이름 중복', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '전자기기',
          slug: 'electronics-duplicate',
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('이미 존재하는 카테고리 이름');
    });

    it('실패: Slug 중복', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '전자제품',
          slug: 'electronics',
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('이미 사용 중인 슬러그');
    });

    it('실패: 필수 필드 누락', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '스포츠',
        })
        .expect(400);
    });

    it('실패: 잘못된 Slug 형식', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '생활용품',
          slug: '생활용품', // 한글 불가
        })
        .expect(400);
    });
  });

  describe('GET /api/v1/categories - 전체 카테고리 조회', () => {
    it('성공: 전체 카테고리 목록 조회 (공개 API)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/categories')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('성공: 활성 카테고리만 조회', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/categories?isActive=true')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.every((cat) => cat.isActive === true)).toBe(true);
    });
  });

  describe('GET /api/v1/categories/tree - 카테고리 트리 조회', () => {
    it('성공: 전체 ���테고리 트리 조회', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/categories/tree')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      // 최상위 카테고리 확인
      const rootCategory = response.body.data.find((c) => c.name === '전자기기');
      expect(rootCategory).toBeDefined();

      // 하위 카테고리 확인
      expect(rootCategory.children).toBeDefined();
      expect(Array.isArray(rootCategory.children)).toBe(true);
    });
  });

  describe('GET /api/v1/categories/roots - 최상위 카테고리 조회', () => {
    it('성공: 최상위 카테고리만 조회', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/categories/roots')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      // 최상위 카테고리만 반환되는지 확인
      expect(response.body.data.every((cat) => cat.parentId === null)).toBe(true);
    });
  });

  describe('GET /api/v1/categories/slug/:slug - Slug로 카테고리 조회', () => {
    it('성공: Slug로 카테고리 조회', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/categories/slug/electronics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.slug).toBe('electronics');
      expect(response.body.data.name).toBe('전자기기');
    });

    it('실패: 존재하지 않는 Slug', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/categories/slug/non-existent')
        .expect(404);
    });
  });

  describe('GET /api/v1/categories/:id - ID로 카테고리 조회', () => {
    it('성공: ID로 카테고리 조회', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/categories/${categoryId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(categoryId);
      expect(response.body.data.name).toBe('전자기기');
    });

    it('성공: 하위 카테고리 포함 조회', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/categories/${categoryId}?includeChildren=true`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.children).toBeDefined();
      expect(Array.isArray(response.body.data.children)).toBe(true);
    });

    it('실패: 존재하지 않는 카테고리 ID', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/categories/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('GET /api/v1/categories/:id/children - 하위 카테고리 조회', () => {
    it('성공: 특정 카테고리의 자식 조회', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/categories/${categoryId}/children`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data.every((c) => c.parentId === categoryId)).toBe(true);
    });

    it('실패: 존재하지 않는 부모 카테고리', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/categories/00000000-0000-0000-0000-000000000000/children')
        .expect(404);
    });
  });

  describe('PATCH /api/v1/categories/:id - 카테고리 수정', () => {
    it('성공: 관리자가 카테고리 수정', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '전자제품',
          icon: 'https://example.com/icons/electronics-new.svg',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('전자제품');
      expect(response.body.data.slug).toBe('electronics'); // slug는 변경 안 함
    });

    it('실패: 인증 없이 카테고리 수정', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/categories/${categoryId}`)
        .send({
          name: '전자기기 수정',
        })
        .expect(401);
    });

    it('실패: 일반 사용자가 카테고리 수정', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/categories/${categoryId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: '전자기기 수정',
        })
        .expect(403);
    });

    it('실패: 존재하지 않는 카테고리 수정', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/categories/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '수정',
        })
        .expect(404);
    });
  });

  describe('PATCH /api/v1/categories/:id/order - 카테고리 순서 변경', () => {
    it('성공: 카테고리 순서 변경', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/categories/${categoryId}/order?order=5`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.order).toBe(5);
    });

    it('실패: 인증 없이 순서 변경', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/categories/${categoryId}/order?order=10`)
        .expect(401);
    });

    it('실패: 일반 사용자가 순서 변경', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/categories/${categoryId}/order?order=10`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe('DELETE /api/v1/categories/:id - 카테고리 삭제', () => {
    it('실패: 하위 카테고리가 있는 카테고리 삭제', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('하위 카테고리');
    });

    it('성공: 하위 카테고리 삭제 (자식이 없음)', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/categories/${childCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      // 삭제 확인
      const category = await prisma.category.findUnique({
        where: { id: childCategoryId },
      });

      expect(category).toBeNull();
    });

    it('성공: 이제 부모 카테고리도 삭제 가능', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });

    it('실패: 인증 없이 카테고리 삭제', async () => {
      // 새 카테고리 생성
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '테스트',
          slug: 'test',
        })
        .expect(201);

      const testCategoryId = createResponse.body.data.id;

      // 인증 없이 삭제 시도
      await request(app.getHttpServer())
        .delete(`/api/v1/categories/${testCategoryId}`)
        .expect(401);
    });

    it('실패: 일반 사용자가 카테고리 삭제', async () => {
      // 새 카테고리 생성
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '테스트2',
          slug: 'test2',
        })
        .expect(201);

      const testCategoryId = createResponse.body.data.id;

      // 일반 사용자가 삭제 시도
      await request(app.getHttpServer())
        .delete(`/api/v1/categories/${testCategoryId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('실패: 존재하지 않는 카테고리 삭제', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/categories/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });
});
