import { PrismaService } from '@/prisma/prisma.service';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

/**
 * 테스트용 상품 생성 헬퍼
 */
export async function createTestProduct(
  app: INestApplication,
  token: string,
  prisma: PrismaService,
  overrides?: {
    title?: string;
    description?: string;
    price?: number;
    condition?: string;
  }
) {
  // 카테고리 조회
  const categories = await prisma.category.findMany();
  const categoryId = categories[0].id;

  // 상품 생성
  const response = await request(app.getHttpServer())
    .post('/api/v1/products')
    .set('Authorization', `Bearer ${token}`)
    .send({
      categoryId,
      title: overrides?.title || '테스트용 상품',
      description: overrides?.description || '테스트용 상품입니다',
      price: overrides?.price || 10000,
      condition: overrides?.condition || 'GOOD',
    })
    .expect(201);

  return response.body.data;
}

/**
 * 테스트용 주문 생성 헬퍼
 */
export async function createTestOrder(
  app: INestApplication,
  token: string,
  productId: string,
  overrides?: {
    totalAmount?: number;
    shippingFee?: number;
  }
) {
  const response = await request(app.getHttpServer())
    .post('/api/v1/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({
      productId,
      totalAmount: overrides?.totalAmount || 10000,
      shippingFee: overrides?.shippingFee || 0,
    })
    .expect(201);

  return response.body.data;
}

/**
 * 주문 상태 업데이트 헬퍼
 */
export async function updateOrderStatus(
  app: INestApplication,
  token: string,
  orderId: string,
  status: string,
) {
  const response = await request(app.getHttpServer())
    .put(`/api/v1/orders/${orderId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      status,
    })
    .expect(200);

  return response.body.data;
}

/**
 * 완료된 주문 생성 헬퍼 (상품 생성 -> 주문 생성 -> 배송 -> 확정)
 */
export async function createTestCompletedOrder(
  app: INestApplication,
  buyerToken: string,
  sellerToken: string,
  prisma: PrismaService,
) {
  // 1. 상품 생성
  const product = await createTestProduct(app, buyerToken, prisma);

  // 2. 주문 생성
  const order = await createTestOrder(app, sellerToken, product.id);

  // 3. 주문 상태 업데이트 (DELIVERED)
  await updateOrderStatus(app, sellerToken, order.id, 'DELIVERED');

  return { product, order };
}

