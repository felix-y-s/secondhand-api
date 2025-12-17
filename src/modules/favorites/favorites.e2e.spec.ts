import { AppModule } from '@/app.module';
import { JwtPayload } from '@/modules/auth';
import { HttpExceptionFilter } from '@/common/filters';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import { PrismaService } from '@/prisma/prisma.service';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { TestDataFactory } from '@/test/fixtures/test-data.factory';

describe('Favorite API E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let configService: ConfigService;
  let testDataFactory: TestDataFactory;
  let apiBasePath: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();

    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);
    configService = app.get<ConfigService>(ConfigService);
    testDataFactory = new TestDataFactory(prisma, configService, jwtService);

    apiBasePath = configService.getOrThrow<string>('app.apiBasePath');
    app.setGlobalPrefix(apiBasePath);

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

    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();
  });
  afterAll(async () => {
    await testDataFactory.cleanupAll();
    await app.close();
  });

  describe('찜하기', () => {
    let accessToken: string;
    let productId: string;
    let buyerId: string;

    beforeAll(async () => {
      const { buyer, product } = await testDataFactory.createUserWithProduct();
      productId = product.id;
      buyerId = buyer.id;
      const payload: JwtPayload = {
        sub: buyer.id,
        email: buyer.email,
        role: buyer.role,
        type: 'access',
      };
      accessToken = await testDataFactory.createAccessToken(payload);
    });

    describe('성공 케이스', () => {
      let favoriteId: string;
      afterAll(async () => {
        await prisma.favorite.delete({
          where: { id: favoriteId },
        });
      });
      it('찜하기', async () => {
        const res = await request(app.getHttpServer())
          .post(`/${apiBasePath}/favorites`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            productId,
          })
          .expect(201);
        const body = res.body;
        expect(body.success).toBeTruthy();
        expect(body.data.productId).toEqual(productId);
        expect(body.data.userId).toEqual(buyerId);
        favoriteId = body.data.id;
      });
    });
    describe('실패 케이스', () => {
      beforeAll(async () => {
        await prisma.favorite.create({
          data: {
            userId: buyerId,
            productId,
          },
        });
      });
      afterAll(async () => {
        await prisma.favorite.deleteMany({
          where: {
            userId: buyerId,
            productId,
          },
        });
      });

      it('찜한 상품을 다시 찜하면 실패', async () => {
        const res = await request(app.getHttpServer())
          .post(`/${apiBasePath}/favorites`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            productId,
          })
          .expect(409);

        const body = res.body;
        expect(body.success).toBeFalsy();
      });
    });
  });

  describe('찜 목록 조회', () => {
    let userId: string;
    let accessToken: string;
    const expectedFavoritesCount = 20;

    beforeAll(async () => {
      // 찜 목록 추가
      const { buyer: user } = await testDataFactory.createUserWithFavorites(
        expectedFavoritesCount,
      );
      userId = user.id;
      const payload: JwtPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        type: 'access',
      };
      accessToken = await testDataFactory.createAccessToken(payload);
    });

    describe('성공 케이스', () => {
      it('찜 목록 조회', async () => {
        const page = 2;
        const limit = 10;
        const res = await request(app.getHttpServer())
          .get(
            `/${apiBasePath}/favorites?page=${page}&limit=${limit}&order=createdAt&sort=asc`,
          )
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);
        const body = res.body;
        const totalPage = Math.ceil(expectedFavoritesCount / limit);

        expect(body.success).toBeTruthy();
        expect(body.data.favorites).toBeDefined();
        expect(body.data.page).toBe(page);
        expect(body.data.limit).toBe(limit);
        expect(body.data.total).toBe(expectedFavoritesCount);
        expect(body.data.totalPage).toBe(totalPage);
      });
      it('페이지네이션 - 범위 초과 시 빈 배열 반환', async () => {
        const page = 20;
        const limit = 10;
        const res = await request(app.getHttpServer())
          .get(`/${apiBasePath}/favorites?page=${page}&limit=${limit}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);
        const body = res.body;
        const totalPage = Math.ceil(expectedFavoritesCount / limit);
        expect(body.success).toBeTruthy();
        expect(body.data.favorites).toBeDefined();
        expect(body.data.page).toBe(page);
        expect(body.data.limit).toBe(limit);
        expect(body.data.total).toBe(expectedFavoritesCount);
        expect(body.data.totalPage).toBe(totalPage);
        expect(body.data.hasNext).toBeFalsy();
      });
    });
    describe('실패 케이스', () => {
      it('입력값 오류', async () => {
        const res = await request(app.getHttpServer())
          .get(`/${apiBasePath}/favorites?page=a&limit=200&sort=s&order=o`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(400);
        const body = res.body;
        expect(body.success).toBeFalsy();
        expect(body.error.message).toContain('limit는 100 이하여야 합니다.');
        expect(body.error.message).toContain('page는 1 이상이어야 합니다.');
      });
    });
  });

  describe('찜 여부 확인', () => {
    let favoritesProductId: string;
    let notFavoritesProductId: string;
    let buyerId: string;
    let accessToken: string;

    beforeAll(async () => {
      // 찜 데이터 생성
      const { buyer, favorites } =
        await testDataFactory.createUserWithFavorites(1);
      favoritesProductId = favorites[0].productId;
      buyerId = buyer.id;
      const payload: JwtPayload = {
        sub: buyer.id,
        email: buyer.email,
        role: buyer.role,
        type: 'access',
      };
      notFavoritesProductId = (await testDataFactory.createUserWithProduct())
        .product.id;
      accessToken = await testDataFactory.createAccessToken(payload);
    });

    describe('성공 케이스', () => {
      it('찜 한 상품 조회', async () => {
        const res = await request(app.getHttpServer())
          .get(`/${apiBasePath}/favorites/${favoritesProductId}/exist`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);
        const body = res.body;
        expect(body.success).toBeTruthy();
        expect(body.data.isFavorite).toBeTruthy();
      });
      it('찜 안한 상품 조회', async () => {
        const res = await request(app.getHttpServer())
          .get(`/${apiBasePath}/favorites/${notFavoritesProductId}/exist`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);
        const body = res.body;
        expect(body.success).toBeTruthy();
        expect(body.data.isFavorite).toBeFalsy();
      });
    });
    describe('실패 케이스', () => {
      it('상품 아이디 포맷 오류', async () => {
        const res = await request(app.getHttpServer())
          .get(`/${apiBasePath}/favorites/not-exist-productID/exist`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(400);
        const body = res.body;
        expect(body.success).toBeFalsy();
        expect(body.error.message).toContain(
          'productId는 uuid 타입이어야 합니다.',
        );
      });
    });
  });

  describe('찜 삭제', () => {
    let buyer, favorites;
    let accessToken;
    beforeAll(async () => {
      // 테스트 찜 목록 생성
      ({ buyer, favorites } = await testDataFactory.createUserWithFavorites(2));
      accessToken = await testDataFactory.createAccessToken({
        sub: buyer.id,
        email: buyer.email,
        role: buyer.role,
        type: 'access',
      });
    });
    describe('성공 케이스', () => {
      it('찜 삭제', async () => {
        const res = await request(app.getHttpServer())
          .delete(`/${apiBasePath}/favorites/${favorites[0].productId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);
        const body = res.body;
        expect(body.success).toBeTruthy();
        expect(body.data.isDeleted).toBeTruthy();

        // 다른 찜은 유지
        const findFavorite = await prisma.favorite.findUnique({
          where: { id: favorites[1].id },
        });
        expect(findFavorite).toBeDefined();
      });
    });
    describe('실패 케이스', () => {
      it('잘못된 상품 아이디는 삭제 실패', async () => {
        const res = await request(app.getHttpServer())
          .delete(`/${apiBasePath}/favorites/not-exist`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(400);

        const body = res.body;
        expect(body.success).toBeFalsy();
        expect(body.error.message).toContain(
          'productId는 uuid 타입이어야 합니다.',
        );
      });
      it('존재하지 않는 찜 삭제 시도', async () => {
        const randomProductId = uuidv4();
        const res = await request(app.getHttpServer())
          .delete(`/${apiBasePath}/favorites/${randomProductId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        const body = res.body;
        expect(body.data.isDeleted).toBeFalsy();
      });
    });
  });
});
