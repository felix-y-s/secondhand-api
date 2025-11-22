import { PrismaService } from '@/prisma/prisma.service';
import { UsersService } from './users.service';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersRepository } from './repositories/users.repository';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OrdersService } from '../orders/orders.service';
import { OrdersRepository } from '../orders/repositories/orders.repository';
import { ProductsRepository } from '../products/repositories/products.repository';

describe('UsersService', () => {
  let usersService: UsersService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [],
      providers: [
        UsersService,
        UsersRepository,
        JwtService,
        ConfigService,
        OrdersService,
        OrdersRepository,
        PrismaService,
        ProductsRepository,
      ],
    }).compile();

    usersService = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('회원 탈퇴', () => {
    let testSellerId: string;
    let testBuyerId: string;
    let testCategoryId: string;
    let testProductId: string;
    let testOrderId: string;
    const password = 'Password123!';

    // 공통 데이터: 모든 테스트에서 공유
    beforeAll(async () => {
      const timestamp = Date.now();

      // Category: 모든 테스트에서 공유
      testCategoryId = (
        await prisma.category.create({
          data: {
            name: `테스트-카테고리-${timestamp}`,
            slug: `test-category-${timestamp}`,
          },
        })
      ).id;

      // Buyer: 주문 관련 테스트에서 공유
      testBuyerId = (
        await prisma.user.create({
          data: {
            email: `test-buyer-${timestamp}@test.com`,
            password,
            nickname: `테스트-구매자-${timestamp}`,
          },
        })
      ).id;
    });

    // 공통 데이터 정리
    afterAll(async () => {
      try {
        await prisma.user.deleteMany({ where: { id: testBuyerId } });
        await prisma.category.deleteMany({ where: { id: testCategoryId } });
      } catch (error) {
        console.error('❌ 공통 테스트 데이터 정리 실패:', error);
      }
    });

    describe('실패 케이스', () => {
      beforeAll(async () => {
        const timestamp = Date.now();

        // Seller, Product, Order는 이 테스트에서만 사용
        testSellerId = (
          await prisma.user.create({
            data: {
              email: `test-seller-${timestamp}@test.com`,
              password,
              nickname: `테스트-판매자-${timestamp}`,
            },
          })
        ).id;

        testProductId = (
          await prisma.product.create({
            data: {
              sellerId: testSellerId,
              categoryId: testCategoryId,
              title: `테스트-상품-${timestamp}`,
              description: '테스트용 상품',
              price: 10000,
              condition: 'GOOD',
            },
          })
        ).id;

        testOrderId = (
          await prisma.order.create({
            data: {
              productId: testProductId,
              buyerId: testBuyerId,
              sellerId: testSellerId,
              orderNumber: `ORD-${timestamp}`,
              totalAmount: 10000,
              status: 'PAID',
            },
          })
        ).id;
      });

      afterAll(async () => {
        try {
          await prisma.order.deleteMany({ where: { id: testOrderId } });
          await prisma.product.deleteMany({ where: { id: testProductId } });
          await prisma.user.deleteMany({ where: { id: testSellerId } });
        } catch (error) {
          console.error('❌ 테스트 데이터 정리 실패:', error);
        }
      });

      it('사용자가 없으면 NotFoundException 발생', async () => {
        await expect(usersService.remove('nonexistent-id')).rejects.toThrow(
          '사용자를 찾을 수 없습니다.',
        );
      });

      it('진행 중인 주문(PAID)이 있으면 탈퇴 불가', async () => {
        await expect(usersService.remove(testSellerId)).rejects.toThrow(
          '진행 중인 거래가 있어 탈퇴할 수 없습니다. 모든 거래를 완료하거나 취소해주세요.',
        );
      });
    });

    describe('성공 케이스 - PENDING 주문 자동 취소', () => {
      beforeAll(async () => {
        const timestamp = Date.now();

        testSellerId = (
          await prisma.user.create({
            data: {
              email: `test-seller-${timestamp}@test.com`,
              password,
              nickname: `테스트-판매자-${timestamp}`,
            },
          })
        ).id;

        testProductId = (
          await prisma.product.create({
            data: {
              sellerId: testSellerId,
              categoryId: testCategoryId,
              title: `테스트-상품-${timestamp}`,
              description: '테스트용 상품',
              price: 10000,
              condition: 'GOOD',
              status: 'ACTIVE',
            },
          })
        ).id;

        testOrderId = (
          await prisma.order.create({
            data: {
              productId: testProductId,
              buyerId: testBuyerId,
              sellerId: testSellerId,
              orderNumber: `ORD-${timestamp}`,
              totalAmount: 10000,
              status: 'PENDING',
            },
          })
        ).id;
      });

      afterAll(async () => {
        try {
          await prisma.order.deleteMany({ where: { id: testOrderId } });
          await prisma.product.deleteMany({ where: { id: testProductId } });
          await prisma.user.deleteMany({ where: { id: testSellerId } });
        } catch (error) {
          console.error('❌ 테스트 데이터 정리 실패:', error);
        }
      });

      it('판매자 탈퇴 시 PENDING 주문은 CANCELLED로 변경', async () => {
        await usersService.remove(testSellerId);

        const deletedUser = await prisma.user.findUnique({
          where: { id: testSellerId },
        });
        expect(deletedUser?.isActive).toBe(false);

        const cancelledOrder = await prisma.order.findUnique({
          where: { id: testOrderId },
        });
        expect(cancelledOrder?.status).toBe('CANCELLED');

        const deletedProduct = await prisma.product.findUnique({
          where: { id: testProductId },
        });
        expect(deletedProduct?.status).toBe('DELETED');
      });
    });

    describe('성공 케이스 - PAYMENT_PENDING 주문 자동 취소', () => {
      beforeAll(async () => {
        const timestamp = Date.now();

        testSellerId = (
          await prisma.user.create({
            data: {
              email: `test-seller-${timestamp}@test.com`,
              password,
              nickname: `테스트-판매자-${timestamp}`,
            },
          })
        ).id;

        testProductId = (
          await prisma.product.create({
            data: {
              sellerId: testSellerId,
              categoryId: testCategoryId,
              title: `테스트-상품-${timestamp}`,
              description: '테스트용 상품',
              price: 10000,
              condition: 'GOOD',
              status: 'ACTIVE',
            },
          })
        ).id;

        testOrderId = (
          await prisma.order.create({
            data: {
              productId: testProductId,
              buyerId: testBuyerId,
              sellerId: testSellerId,
              orderNumber: `ORD-${timestamp}`,
              totalAmount: 10000,
              status: 'PAYMENT_PENDING',
            },
          })
        ).id;
      });

      afterAll(async () => {
        try {
          await prisma.order.deleteMany({ where: { id: testOrderId } });
          await prisma.product.deleteMany({ where: { id: testProductId } });
          await prisma.user.deleteMany({ where: { id: testSellerId } });
        } catch (error) {
          console.error('❌ 테스트 데이터 정리 실패:', error);
        }
      });

      it('판매자 탈퇴 시 PAYMENT_PENDING 주문은 CANCELLED로 변경', async () => {
        await usersService.remove(testSellerId);

        const cancelledOrder = await prisma.order.findUnique({
          where: { id: testOrderId },
        });
        expect(cancelledOrder?.status).toBe('CANCELLED');
      });
    });

    describe('이미 삭제된 계정', () => {
      let deletedUserId: string;

      beforeAll(async () => {
        const timestamp = Date.now();

        // 사용자 생성 후 즉시 삭제
        deletedUserId = (
          await prisma.user.create({
            data: {
              email: `deleted-user-${timestamp}@test.com`,
              password,
              nickname: `삭제된사용자-${timestamp}`,
              isActive: false, // 이미 삭제된 상태
            },
          })
        ).id;
      });

      afterAll(async () => {
        try {
          await prisma.user.deleteMany({ where: { id: deletedUserId } });
        } catch (error) {
          console.error('❌ 테스트 데이터 정리 실패:', error);
        }
      });

      it('이미 탈퇴한 계정은 재탈퇴 불가', async () => {
        await expect(usersService.remove(deletedUserId)).rejects.toThrow(
          '이미 탈퇴한 계정입니다.',
        );
      });
    });
  })
});
