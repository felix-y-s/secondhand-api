import { JwtPayload } from '@/modules/auth';
import { ReviewsRepository } from '@/modules/reviews/repositories';
import { PrismaService } from '@/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OrderStatus, ProductStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/**
 * E2E 테스트용 데이터 팩토리
 * 복잡한 데이터 구조를 쉽게 생성하고 재사용할 수 있도록 지원
 */
export class TestDataFactory {
  constructor(
    public readonly prisma: PrismaService,
    private readonly configService?: ConfigService,
    private readonly jwtService?: JwtService,
  ) {}

  /**
   * 기본 카테고리 생성
   */
  async createCategory(
    overrides: Partial<{ name: string; slug: string }> = {},
  ) {
    const timestamp = Date.now();
    return await this.prisma.category.create({
      data: {
        name: overrides.name || `카테고리-${timestamp}`,
        slug: overrides.slug || `category-${timestamp}`,
        icon: '📦',
        order: 0,
      },
    });
  }
  // user-1764243683206@test.com

  /**
   * 기본 사용자 생성
   */
  async createUser(
    overrides: Partial<{
      email: string;
      password: string;
      nickname: string;
      role: Role;
      isActive: boolean;
    }> = {},
  ) {
    const timestamp = Date.now();
    const password = overrides.password || 'Test1234!';
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: overrides.email || `user-${timestamp}@test.com`,
        password: hashedPassword,
        nickname: overrides.nickname || `user-${timestamp}`,
        role: overrides.role || Role.USER,
        isActive: overrides.isActive !== undefined ? overrides.isActive : true,
      },
    });
    const token = await this.createAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      ...user,
      token,
    };
  }

  /**
   * 판매자와 구매자 쌍 생성
   */
  async createSellerAndBuyer() {
    const timestamp = Date.now();

    const seller = await this.createUser({
      email: `seller-${timestamp}@test.com`,
      nickname: `seller-${timestamp}`,
    });

    const buyer = await this.createUser({
      email: `buyer-${timestamp}@test.com`,
      nickname: `buyer-${timestamp}`,
    });

    return { seller, buyer };
  }

  /**
   * 기본 상품 생성
   */
  async createProduct(
    sellerId: string,
    categoryId: string,
    overrides: Partial<{
      title: string;
      price: number;
      status: ProductStatus;
    }> = {},
  ) {
    const timestamp = Date.now();
    const randomtime = Math.random() * 10000;
    return await this.prisma.product.create({
      data: {
        title: overrides.title || `상품-${timestamp}`,
        description: '테스트용 상품입니다',
        price: overrides.price || 10000,
        condition: 'GOOD',
        status: overrides.status || ProductStatus.ACTIVE,
        sellerId,
        categoryId,
        createdAt: new Date(timestamp + randomtime),
        updatedAt: new Date(timestamp + randomtime),
      },
    });
  }

  /**
   * 주문 생성
   */
  async createOrder(
    buyerId: string,
    sellerId: string,
    productId: string,
    status: OrderStatus = OrderStatus.PENDING,
  ) {
    const timestamp = Date.now();
    return await this.prisma.order.create({
      data: {
        orderNumber: `TEST-${timestamp}`,
        buyerId,
        sellerId,
        productId,
        totalAmount: 10000,
        shippingFee: 3000,
        status,
      },
    });
  }

  /**
   * 리뷰 생성
   */
  async createReview(
    orderId: string,
    reviewerId: string,
    revieweeId: string,
    rating: number,
  ) {
    return await this.prisma.review.create({
      data: {
        orderId,
        reviewerId,
        reviewedId: revieweeId,
        rating,
      },
    });
  }

  /**
   * 리뷰 삭제
   */
  async deleteReview(reviewId: string) {
    await this.prisma.review.delete({
      where: { id: reviewId },
    });
  }

  /**
   * 찜하기 생성
   */
  async createFavorite(userId: string, productId: string) {
    const favorite = await this.prisma.favorite.create({
      data: { userId, productId },
    });
    return favorite;
  }

  /**
   * 진행중인 주문이 있는 사용자 시나리오 생성
   *
   * @returns 구매자, 판매자, 상품, 진행중인 주문 정보
   */
  async createUserWithOngoingOrder() {
    // 1. 카테고리 생성
    const category = await this.createCategory();

    // 2. 판매자와 구매자 생성
    const { seller, buyer } = await this.createSellerAndBuyer();

    // 3. 상품 생성
    const product = await this.createProduct(seller.id, category.id);

    // 4. 진행중인 주문 생성 (PAID 상태)
    const order = await this.createOrder(
      buyer.id,
      seller.id,
      product.id,
      OrderStatus.PAID,
    );

    return {
      buyer,
      seller,
      product,
      order,
      category,
    };
  }

  /**
   * 완료된 주문만 있는 사용자 시나리오 생성
   */
  async createUserWithCompletedOrder() {
    return this.createUserWithOrder(OrderStatus.CONFIRMED);
  }

  /**
   *
   * @param status
   * - PENDING:
   * - PAYMENT_PENDING:
   * - PAID:
   * - SHIPPING:
   * - DELIVERED:
   * - CONFIRMED: 거래 확정
   * - CANCELLED:
   * - REFUNDED:
   * @returns
   */
  async createUserWithOrder(status: OrderStatus = OrderStatus.CONFIRMED) {
    const data = await this.createUserWithOngoingOrder();

    // 주문 상태를 변경
    await this.prisma.order.update({
      where: { id: data.order.id },
      data: { status },
    });

    return data;
  }

  /**
   * 주문 이력이 없는 깨끗한 사용자 생성
   */
  async createCleanUser() {
    return await this.createUser();
  }

  /**
   * 비활성(탈퇴) 사용자 생성
   */
  async createInactiveUser() {
    return await this.createUser({ isActive: false });
  }

  /**
   * 여러 진행중인 주문이 있는 사용자 (엣지 케이스)
   */
  async createUserWithMultipleOngoingOrders(count: number = 3) {
    const category = await this.createCategory();
    const { seller, buyer } = await this.createSellerAndBuyer();

    const orders: Awaited<ReturnType<typeof this.createOrder>>[] = [];
    for (let i = 0; i < count; i++) {
      const product = await this.createProduct(seller.id, category.id, {
        title: `상품-${i + 1}`,
      });

      const order = await this.createOrder(
        buyer.id,
        seller.id,
        product.id,
        OrderStatus.PAID,
      );

      orders.push(order);
    }

    return {
      buyer,
      seller,
      orders,
      category,
    };
  }

  /**
   * 판매자와 상품 생성
   */
  async createUserWithProduct() {
    const category = await this.createCategory();
    const buyer = await this.createUser();
    const seller = await this.createUser();
    const product = await this.createProduct(seller.id, category.id);

    return {
      buyer,
      seller,
      product,
      category,
    };
  }

  /**
   * 구매자와 찜 목록 추가
   */
  async createUserWithFavorites(count: number = 1) {
    // 카테고리 만들고
    const category = await this.createCategory();
    const buyer = await this.createUser();
    const seller = await this.createUser();

    const favorites = await Promise.all(
      Array.from({ length: count }).map(async (_, index) => {
        const { id: productId } = await this.createProduct(
          seller.id,
          category.id,
          {
            title: `상품-${index + 1}`,
          },
        );
        return await this.createFavorite(buyer.id, productId);
      }),
    );

    return {
      buyer,
      favorites,
    };
  }

  /**
   * 테스트 데이터 정리 헬퍼
   * 특정 이메일 패턴으로 생성된 모든 데이터 삭제
   */
  async cleanup(emailPattern: string) {
    // 주문 삭제
    await this.prisma.order.deleteMany({
      where: {
        OR: [
          { buyer: { email: { contains: emailPattern } } },
          { seller: { email: { contains: emailPattern } } },
        ],
      },
    });

    // 상품 삭제
    await this.prisma.product.deleteMany({
      where: { seller: { email: { contains: emailPattern } } },
    });

    // 사용자 삭제
    await this.prisma.user.deleteMany({
      where: { email: { contains: emailPattern } },
    });

    // 카테고리는 재사용 가능하므로 선택적 삭제
  }

  async createAccessToken(payload: JwtPayload) {
    if (!this.jwtService) {
      throw new Error('JWT 서비스가 설정되지 않았습니다.');
    }
    if (!this.configService) {
      throw new Error('환경 변수 서비스가 설정되지 않았습니다.');
    }
    return await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '1h',
    });
  }

  /**
   * 모든 테스트 데이터 일괄 정리
   * Factory가 생성한 모든 timestamp 기반 데이터 삭제
   */
  async cleanupAll() {
    // 주문 삭제 (Factory가 생성한 모든 테스트 데이터)
    await this.prisma.order.deleteMany({
      where: {
        OR: [
          { buyer: { email: { contains: '@test.com' } } },
          { seller: { email: { contains: '@test.com' } } },
        ],
      },
    });

    // 찜 목록 삭제(참조하는 product, user 가 삭제되면 같이 삭제되도록 설정되어 있지만, deleteMany일떄는 트리거 되지 않아 수동 삭제 필요
    await this.prisma.favorite.deleteMany({
      where: {
        OR: [
          // REMIND: 삭제 방법 학습
          { product: { seller: { email: { contains: '@test.com' } } } },
          { user: { email: { contains: '@test.com' } } },
        ],
      },
    });

    // 상품 삭제
    await this.prisma.product.deleteMany({
      where: { seller: { email: { contains: '@test.com' } } },
    });

    // 사용자 삭제 (Factory의 패턴: user-, seller-, buyer-, clean-)
    await this.prisma.user.deleteMany({
      where: {
        OR: [
          { email: { contains: 'user-' } },
          { email: { contains: 'seller-' } },
          { email: { contains: 'buyer-' } },
          { email: { contains: 'clean-' } },
        ],
      },
    });

    // 카테고리 삭제 (Factory의 패턴: category-, test-)
    await this.prisma.category.deleteMany({
      where: {
        OR: [
          { slug: { startsWith: 'category-' } },
          { slug: { startsWith: 'test-' } },
        ],
      },
    });
  }
}

// ! 테스트 데이터 생성 클래스가 너무 커져서 사용성/가독성이 떨어지는 문제를 개선하기 위해 별도의 클래스로 재구성
export class TestReviewDataFactory {
  private reviewer: Awaited<ReturnType<TestDataFactory['createUser']>>;
  private reviewee: Awaited<ReturnType<TestDataFactory['createUser']>>;
  private testDataFactory: TestDataFactory;
  private prisma: PrismaService;

  constructor() {}

  static async create(testDataFactory: TestDataFactory, prisma: PrismaService) {
    const instance = new TestReviewDataFactory();
    instance.testDataFactory = testDataFactory;
    instance.prisma = prisma;
    const { seller, buyer } = await testDataFactory.createSellerAndBuyer();
    instance.reviewer = buyer;
    instance.reviewee = seller;
    return instance;
  }

  /**
   * 리뷰 가능한 주문 생성
   */
  async createReviewableOrder() {
    const category = await this.testDataFactory.createCategory();
    const product = await this.testDataFactory.createProduct(
      this.reviewee.id,
      category.id,
    );
    const order = await this.testDataFactory.createOrder(
      this.reviewer.id,
      this.reviewee.id,
      product.id,
      OrderStatus.CONFIRMED,
    );
    return {
      reviewer: this.reviewer,
      reviewee: this.reviewee,
      order,
    };
  }

  /**
   * 이미 리뷰 작성된 주문 만들기
   */
  async createReviewedOrder() {
    const category = await this.testDataFactory.createCategory();
    const product = await this.testDataFactory.createProduct(
      this.reviewee.id,
      category.id,
    );
    const order = await this.testDataFactory.createOrder(
      this.reviewer.id,
      this.reviewee.id,
      product.id,
      OrderStatus.CONFIRMED,
    );
    await this.testDataFactory.createReview(
      order.id,
      this.reviewer.id,
      this.reviewee.id,
      Math.random() * 5 + 1,
    );
    return {
      reviewer: this.reviewer,
      reviewee: this.reviewee,
      order,
    };
  }

  /**
   * 완료되지 않은 주문 생성
   */
  async createUncompletedOrder() {
    const category = await this.testDataFactory.createCategory();
    const product = await this.testDataFactory.createProduct(
      this.reviewee.id,
      category.id,
    );
    const order = await this.testDataFactory.createOrder(
      this.reviewer.id,
      this.reviewee.id,
      product.id,
      OrderStatus.PENDING,
    );
    return {
      reviewer: this.reviewer,
      reviewee: this.reviewee,
      order,
    };
  }

  async createReviewerWithReviews(count: number) {
    // 정확한 리뷰 카운트 조회를 위해서 기본 리뷰는 정리
    this.cleanupReview();
    const category = await this.testDataFactory.createCategory();
    const orders = Array<any>();
    const products = Array<any>();
    const reviews = Array<any>();

    for (let index = 0; index < count; index++) {
      const product = await this.testDataFactory.createProduct(
        this.reviewee.id,
        category.id,
      );

      const order = await this.testDataFactory.createOrder(
        this.reviewer.id,
        this.reviewee.id,
        product.id,
        OrderStatus.CONFIRMED,
      );
      const review = await this.testDataFactory.createReview(
        order.id,
        this.reviewer.id,
        this.reviewee.id,
        Math.random() * 5 + 1,
      );
      orders.push(order);
      products.push(product);
      reviews.push(review);
    }

    return {
      category,
      products,
      orders,
      reviews,
      reviewer: this.reviewer,
      reviewee: this.reviewee,
    };
  }

  async deleteReview(reviewId: string) {
    await this.testDataFactory.deleteReview(reviewId);
  }

  async cleanupReview() {
    await this.prisma.review.deleteMany({
      where: {
        OR: [
          { reviewer: { email: { contains: '@test.com' } } },
          { reviewer: { email: { contains: '@test.com' } } },
        ],
      },
    });
  }

  async cleanupAll() {
    await this.cleanupReview();
    await this.testDataFactory.cleanupAll();
  }

  async calculateTrustScore(userId: string) {
    const reviewsRepo = new ReviewsRepository(this.prisma);
    return await reviewsRepo.calculateTrustScore(userId);
  }
}
