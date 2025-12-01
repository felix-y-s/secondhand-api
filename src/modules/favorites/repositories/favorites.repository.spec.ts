import { PrismaService } from '@/prisma/prisma.service';
import { Test, TestingModule } from '@nestjs/testing';
import { FavoritesRepository } from './favorites.repository';
import { Role } from '@prisma/client';

// FIXME: 'test/fixtures/test-data.factory.ts' 모듈 사용하도록 수정 필요
class TestDataFactory {
  constructor(private readonly dbService: PrismaService) {}

  async createTestData() {
    const category = await this.createCategory();
    const seller = await this.createTestUser('seller');
    const buyer = await this.createTestUser('buyer');
    const product = await this.createProduct(category.id, seller.id);

    return {
      seller,
      buyer,
      product,
      category,
    };
  }

  async createCategory() {
    const timestamp = Date.now();
    const category = await this.dbService.category.create({
      data: {
        name: `test-category-${timestamp}`,
        slug: `test-slug-${timestamp}`,
      },
    });

    return category;
  }

  async createProduct(categoryId: string, sellerId: string) {
    const timestamp = Date.now();
    return this.dbService.product.create({
      data: {
        sellerId,
        categoryId,
        title: `ptitle-${timestamp}`,
        price: Math.random() * 10000,
        description: '테스트 데이터입니다.',
        condition: 'GOOD',
      },
    });
  }

  async createTestUser(type: 'seller' | 'buyer') {
    const timestamp = Date.now();
    return await this.dbService.user.create({
      data: {
        email: `test-${type}-${timestamp}@example.com`,
        password: `Password123!`,
        nickname: `test-nickname-${timestamp}`,
        role: Role.USER,
      },
    });
  }

  async clearTestData() {
    // 테스트 상품 삭제
    await this.dbService.product.deleteMany({
      where: {
        seller: {
          email: { contains: '@example.com' },
        },
      },
    });

    // 테스트 카테고리 삭제
    await this.dbService.category.deleteMany({
      where: {
        name: { contains: 'test-category-' },
      },
    });

    // 테스트 사용자 삭제
    await this.dbService.user.deleteMany({
      where: {
        OR: [
          { email: { contains: 'test-seller' } },
          { email: { contains: 'test-buyer' } },
        ],
      },
    });
  }
}
describe('favorite 통합 테스트', () => {
  let favoriteRepository: FavoritesRepository;
  let prisma: PrismaService;
  let testDataFactory: TestDataFactory;
  let testSeller;
  let testBuyer;
  let testProduct;
  let testCategory;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PrismaService, FavoritesRepository],
    }).compile();
    favoriteRepository =
      moduleRef.get<FavoritesRepository>(FavoritesRepository);
    prisma = moduleRef.get<PrismaService>(PrismaService);
    testDataFactory = new TestDataFactory(prisma);

    // 테스트 데이터 생성
    ({
      seller: testSeller,
      buyer: testBuyer,
      product: testProduct,
      category: testCategory,
    } = await testDataFactory.createTestData());
  });
  afterAll(async () => {
    await testDataFactory.clearTestData();
  });

  describe('찜하기 추가', () => {
    afterAll(async () => {
      await prisma.favorite.deleteMany({
        where: {
          userId: testBuyer.id,
          productId: testProduct.id,
        },
      });
    });
    it('찜하기', async () => {
      const result = await favoriteRepository.create(
        testBuyer.id,
        testProduct.id,
      );

      expect(result.userId).toBe(testBuyer.id);
      expect(result.productId).toBe(testProduct.id);
    });
  });
  describe('찜하기 목록 조회', () => {
    let count = 30;
    beforeAll(async () => {
      await prisma.favorite.create({
        data: {
          userId: testBuyer.id,
          productId: testProduct.id,
        },
      });
      await Promise.all(
        Array.from({ length: count }).map(async (_, index) => {
          const product = await testDataFactory.createProduct(
            testCategory.id,
            testSeller.id,
          );
          return prisma.favorite.create({
            data: {
              userId: testBuyer.id,
              productId: product.id,
            },
          });
        }),
      );
    });
    afterAll(async () => {
      await prisma.favorite.deleteMany({
        where: {
          userId: testBuyer.id,
          productId: testProduct.id,
        },
      });
    });
    it('찜하기 목록 조회 - 생성일 내림차순', async () => {
      const limit = 10;
      const page = 2;
      const order = 'createdAt';
      const sort = 'DESC';
      const result = await favoriteRepository.findMany(
        testBuyer.id,
        page,
        limit,
        order,
        sort,
      );
      const favorites = result.items;
      
      expect(result.items[0]).toMatchObject({ userId: testBuyer.id });
      expect(result.total).toBe(count + 1);
      expect(result.totalPage).toBe(Math.ceil((count + 1) / limit));
      expect(result.page).toBe(page);
      for (let index = 0; index < favorites.length - 1; index++) {
        const current = new Date(favorites[index].createdAt).getTime();
        const next = new Date(favorites[index + 1].createdAt).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });
    it('찜하기 목록 조회 - 생성일 오름차순', async () => {
      const limit = 10;
      const page = 2;
      const order = 'createdAt';
      const sort = 'ASC';
      const result = await favoriteRepository.findMany(
        testBuyer.id,
        page,
        limit,
        order,
        sort,
      );
      const favorites = result.items;
      
      expect(result.items[0]).toMatchObject({ userId: testBuyer.id });
      expect(result.total).toBe(count + 1);
      expect(result.totalPage).toBe(Math.ceil((count + 1) / limit));
      expect(result.page).toBe(page);
      for (let index = 0; index < favorites.length - 1; index++) {
        const current = new Date(favorites[index].createdAt).getTime();
        const next = new Date(favorites[index + 1].createdAt).getTime();
        expect(current).toBeLessThanOrEqual(next);
      }
    });
  });
  describe('찜하기 여부 확인', () => {
    beforeAll(async () => {
      // 찜 데이터 추가
      await prisma.favorite.create({
        data: {
          userId: testBuyer.id,
          productId: testProduct.id,
        },
      });
    });
    it('찜한 상품 조회', async () => {
      const isExist = await favoriteRepository.exist(
        testBuyer.id,
        testProduct.id,
      );
      expect(isExist).toBeTruthy();
    });
    it('찜하지 않은 상품 조회', async () => {
      const isExist = await favoriteRepository.exist(
        testSeller.id,
        testProduct.id,
      );
      expect(isExist).toBeFalsy();
    });
  });
});
