import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { OrderStatus, ProductStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

describe('OrdersController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // 테스트 데이터
  let buyerToken: string;
  let sellerToken: string;
  let buyerId: string;
  let sellerId: string;
  let productId: string;
  let categoryId: string;
  let orderId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // 테스트 데이터 정리
    await prisma.order.deleteMany({
      where: {
        OR: [
          { buyer: { email: { contains: 'order-test' } } },
          { seller: { email: { contains: 'order-test' } } },
        ],
      },
    });
    await prisma.product.deleteMany({
      where: { seller: { email: { contains: 'order-test' } } },
    });
    await prisma.category.deleteMany({
      where: { slug: 'order-test-category' },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'order-test' } },
    });

    // 카테고리 생성
    const category = await prisma.category.create({
      data: {
        name: '주문 테스트 카테고리',
        slug: 'order-test-category',
      },
    });
    categoryId = category.id;

    // 판매자 생성 및 로그인
    const hashedPassword = await bcrypt.hash('Seller1234!', 10);
    const seller = await prisma.user.create({
      data: {
        email: 'seller-order-test@example.com',
        password: hashedPassword,
        nickname: 'seller-order-test',
        role: Role.USER,
      },
    });
    sellerId = seller.id;

    const sellerLoginResponse = await request(app.getHttpServer())
      .post('/api/v1/users/login')
      .send({
        email: 'seller-order-test@example.com',
        password: 'Seller1234!',
      })
      .expect(200);

    sellerToken = sellerLoginResponse.body.data.accessToken;

    // 구매자 생성 및 로그인
    const buyer = await prisma.user.create({
      data: {
        email: 'buyer-order-test@example.com',
        password: hashedPassword,
        nickname: 'buyer-order-test',
        role: Role.USER,
      },
    });
    buyerId = buyer.id;

    const buyerLoginResponse = await request(app.getHttpServer())
      .post('/api/v1/users/login')
      .send({
        email: 'buyer-order-test@example.com',
        password: 'Seller1234!',
      })
      .expect(200);

    buyerToken = buyerLoginResponse.body.data.accessToken;

    // 판매 상품 생성 (판매자)
    const product = await prisma.product.create({
      data: {
        title: '주문 테스트 상품',
        description: '주문 테스트용 상품입니다',
        price: 50000,
        condition: 'LIKE_NEW',
        status: ProductStatus.ACTIVE,
        sellerId: sellerId,
        categoryId: categoryId,
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    // 테스트 데이터 정리
    await prisma.order.deleteMany({
      where: {
        OR: [
          { buyer: { email: { contains: 'order-test' } } },
          { seller: { email: { contains: 'order-test' } } },
        ],
      },
    });
    await prisma.product.deleteMany({
      where: { seller: { email: { contains: 'order-test' } } },
    });
    await prisma.category.deleteMany({
      where: { slug: 'order-test-category' },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'order-test' } },
    });

    await app.close();
  });

  describe('POST /api/v1/orders - 주문 생성', () => {
    it('구매자가 주문을 생성할 수 있어야 함', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          productId: productId,
          totalAmount: 50000,
          shippingFee: 3000,
          recipientName: '홍길동',
          recipientPhone: '010-1234-5678',
          shippingAddress: '서울특별시 강남구 테헤란로 123',
          shippingPostcode: '06234',
          paymentMethod: 'CARD',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('orderNumber');
      expect(response.body.data.totalAmount).toBe(50000);
      expect(response.body.data.shippingFee).toBe(3000);
      expect(response.body.data.status).toBe(OrderStatus.PENDING);
      expect(response.body.data.buyerId).toBe(buyerId);
      expect(response.body.data.sellerId).toBe(sellerId);

      orderId = response.body.data.id;

      // 상품 상태가 RESERVED로 변경되었는지 확인
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });
      expect(product?.status).toBe(ProductStatus.RESERVED);
    });

    it('인증 없이 주문 생성 시 401 에러', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/orders')
        .send({
          productId: productId,
          totalAmount: 50000,
        })
        .expect(401);
    });

    it('존재하지 않는 상품 주문 시 404 에러', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          productId: '00000000-0000-0000-0000-000000000000',
          totalAmount: 50000,
        })
        .expect(404);
    });

    it('자신의 상품 주문 시 400 에러', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          productId: productId,
          totalAmount: 50000,
        })
        .expect(400);
    });
  });

  describe('GET /api/v1/orders/:id - 주문 상세 조회', () => {
    it('구매자가 자신의 주문을 조회할 수 있어야 함', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(orderId);
      expect(response.body.data.buyerId).toBe(buyerId);
    });

    it('판매자가 자신의 판매 주문을 조회할 수 있어야 함', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(orderId);
      expect(response.body.data.sellerId).toBe(sellerId);
    });

    it('인증 없이 조회 시 401 에러', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/orders/${orderId}`)
        .expect(401);
    });

    it('존재하지 않는 주문 조회 시 404 에러', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/orders/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(404);
    });
  });

  describe('GET /api/v1/orders/my-purchases - 구매 주문 목록 조회', () => {
    it('구매자가 자신의 구매 목록을 조회할 수 있어야 함', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/orders/my-purchases')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.meta).toHaveProperty('page');
      expect(response.body.meta).toHaveProperty('total');
    });

    it('상태 필터링이 작동해야 함', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/orders/my-purchases')
        .query({ status: OrderStatus.PENDING })
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /api/v1/orders/my-sales - 판매 주문 목록 조회', () => {
    it('판매자가 자신의 판매 목록을 조회할 수 있어야 함', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/orders/my-sales')
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('PATCH /api/v1/orders/:id - 주문 정보 수정', () => {
    it('구매자가 주문 정보를 수정할 수 있어야 함', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          recipientName: '김철수',
          recipientPhone: '010-9876-5432',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.recipientName).toBe('김철수');
      expect(response.body.data.recipientPhone).toBe('010-9876-5432');
    });

    it('상태를 PAID로 변경할 수 있어야 함', async () => {
      // 먼저 PAYMENT_PENDING으로 변경
      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ status: OrderStatus.PAYMENT_PENDING })
        .expect(200);

      // PAID로 변경
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ status: OrderStatus.PAID })
        .expect(200);

      expect(response.body.data.status).toBe(OrderStatus.PAID);
      expect(response.body.data.paidAt).toBeDefined();
    });
  });

  describe('POST /api/v1/orders/:id/cancel - 주문 취소', () => {
    let cancelOrderId: string;

    beforeAll(async () => {
      // 취소 테스트용 새 주문 생성
      const newProduct = await prisma.product.create({
        data: {
          title: '취소 테스트 상품',
          description: '취소 테스트용',
          price: 30000,
          condition: 'GOOD',
          status: ProductStatus.ACTIVE,
          sellerId: sellerId,
          categoryId: categoryId,
        },
      });

      const orderResponse = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          productId: newProduct.id,
          totalAmount: 30000,
        })
        .expect(201);

      cancelOrderId = orderResponse.body.data.id;
    });

    it('구매자가 주문을 취소할 수 있어야 함', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/orders/${cancelOrderId}/cancel`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(OrderStatus.CANCELLED);
      expect(response.body.data.cancelledAt).toBeDefined();
    });

    it('판매자는 주문을 취소할 수 없어야 함', async () => {
      // 새 주문 생성
      const newProduct = await prisma.product.create({
        data: {
          title: '취소 테스트 상품 2',
          description: '취소 테스트용',
          price: 20000,
          condition: 'GOOD',
          status: ProductStatus.ACTIVE,
          sellerId: sellerId,
          categoryId: categoryId,
        },
      });

      const orderResponse = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          productId: newProduct.id,
          totalAmount: 20000,
        })
        .expect(201);

      // 판매자가 취소 시도
      await request(app.getHttpServer())
        .post(`/api/v1/orders/${orderResponse.body.data.id}/cancel`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(403);
    });
  });

  describe('POST /api/v1/orders/:id/confirm - 주문 확정', () => {
    let confirmOrderId: string;

    beforeAll(async () => {
      // 확정 테스트용 주문 생성 및 DELIVERED 상태로 변경
      const newProduct = await prisma.product.create({
        data: {
          title: '확정 테스트 상품',
          description: '확정 테스트용',
          price: 40000,
          condition: 'NEW',
          status: ProductStatus.ACTIVE,
          sellerId: sellerId,
          categoryId: categoryId,
        },
      });

      const orderResponse = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          productId: newProduct.id,
          totalAmount: 40000,
        })
        .expect(201);

      confirmOrderId = orderResponse.body.data.id;

      // 상태를 DELIVERED로 변경 (DB 직접 수정)
      await prisma.order.update({
        where: { id: confirmOrderId },
        data: { status: OrderStatus.DELIVERED },
      });
    });

    it('구매자가 주문을 확정할 수 있어야 함', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/orders/${confirmOrderId}/confirm`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(OrderStatus.CONFIRMED);
      expect(response.body.data.confirmedAt).toBeDefined();

      // 상품 상태가 SOLD로 변경되었는지 확인
      const order = await prisma.order.findUnique({
        where: { id: confirmOrderId },
        include: { product: true },
      });
      expect(order?.product.status).toBe(ProductStatus.SOLD);
    });

    it('판매자는 주문을 확정할 수 없어야 함', async () => {
      // 새 주문 생성 및 DELIVERED 상태로 변경
      const newProduct = await prisma.product.create({
        data: {
          title: '확정 테스트 상품 2',
          description: '확정 테스트용',
          price: 35000,
          condition: 'NEW',
          status: ProductStatus.ACTIVE,
          sellerId: sellerId,
          categoryId: categoryId,
        },
      });

      const orderResponse = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          productId: newProduct.id,
          totalAmount: 35000,
        })
        .expect(201);

      await prisma.order.update({
        where: { id: orderResponse.body.data.id },
        data: { status: OrderStatus.DELIVERED },
      });

      // 판매자��� 확정 시도
      await request(app.getHttpServer())
        .post(`/api/v1/orders/${orderResponse.body.data.id}/confirm`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(403);
    });
  });
});
