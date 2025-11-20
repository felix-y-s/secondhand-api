import { Test, TestingModule } from '@nestjs/testing';
import { MessagesService } from './messages.service';
import { MessageRepository } from './repositories/messages.repository';
import { ProductsService } from '@/modules/products/products.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@/prisma/prisma.service';
import { ProductsRepository } from '@/modules/products/repositories/products.repository';
import { CreateProductDto } from '@/modules/products/dto/create-product.dto';

describe('MessageService', () => {
  let service: MessagesService;
  let productsService: ProductsService;
  let prisma: PrismaService;

  // 테스트 데이터 ID 저장
  let testSellerId: string;
  let testBuyerId: string;
  let testCategoryId: string;
  let testProductId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        ProductsRepository,
        EventEmitter2,
        PrismaService,
        MessagesService,
        MessageRepository,
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    productsService = module.get<ProductsService>(ProductsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('채팅방 생성 또는 조회', () => {
    beforeAll(async () => {
      const timestamp = Date.now();

      // 1. 카테고리 생성
      const category = await prisma.category.create({
        data: {
          name: `테스트카테고리-${timestamp}`,
          slug: `test-category-${timestamp}`,
          icon: '📦',
          order: 0,
        },
      });
      testCategoryId = category.id;

      // 2. 판매자 생성
      const seller = await prisma.user.create({
        data: {
          email: `seller-${timestamp}@test.com`,
          password: 'hashedPassword',
          nickname: '테스트판매자',
          phoneNumber: '01012345678',
        },
      });
      testSellerId = seller.id;

      // 3. 구매자 생성
      const buyer = await prisma.user.create({
        data: {
          email: `buyer-${timestamp}@test.com`,
          password: 'hashedPassword',
          nickname: '테스트구매자',
          phoneNumber: '01087654321',
        },
      });
      testBuyerId = buyer.id;

      // 4. 상품 생성
      const productDto: CreateProductDto = {
        title: '테스트 상품',
        description: '테스트용 상품입니다',
        price: 10000,
        categoryId: testCategoryId,
        condition: 'GOOD',
        images: ['https://example.com/image.jpg'],
        latitude: 37.5665,
        longitude: 126.978,
        location: '서울시 강남구',
      };

      const product = await productsService.create(testSellerId, productDto);
      testProductId = product.id;
    });

    afterAll(async () => {
      // 역순으로 정리
      if (testProductId) {
        await prisma.product.delete({ where: { id: testProductId } }).catch(() => {});
      }
      if (testCategoryId) {
        await prisma.category.delete({ where: { id: testCategoryId } }).catch(() => {});
      }
      if (testBuyerId) {
        await prisma.user.delete({ where: { id: testBuyerId } }).catch(() => {});
      }
      if (testSellerId) {
        await prisma.user.delete({ where: { id: testSellerId } }).catch(() => {});
      }
    });

    it('구매자가 상품에 대해 채팅방을 생성할 수 있어야 함', async () => {
      // When: 구매자가 채팅방 생성
      const result = await service.findOrCreateChatRoom(testBuyerId, testProductId);

      // Then: 채팅방 생성 확인
      expect(result.productId).toBe(testProductId);
      expect(result.members).toHaveLength(2);

      // 구매자와 판매자가 멤버에 포함되어 있는지 확인
      const memberIds = result.members.map((m) => m.userId);
      expect(memberIds).toContain(testBuyerId);
      expect(memberIds).toContain(testSellerId);
    });

    it('동일한 구매자가 같은 상품에 대해 다시 호출하면 기존 채팅방을 반환해야 함', async () => {
      // Given: 이미 채팅방 생성됨 (이전 테스트에서)
      const firstResult = await service.findOrCreateChatRoom(testBuyerId, testProductId);

      // When: 동일한 요청 재시도
      const secondResult = await service.findOrCreateChatRoom(testBuyerId, testProductId);

      // Then: 기존 채팅방 반환 (ID가 동일)
      expect(secondResult.id).toBe(firstResult.id);
      expect(secondResult.members).toHaveLength(2);
    });
  });
});
