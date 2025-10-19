import { PrismaClient, Role, ProductCondition, ProductStatus, OrderStatus, PaymentMethod } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * 시드 데이터 생성 메인 함수
 */
async function main() {
  console.log('🌱 시드 데이터 생성 시작...');

  // 기존 데이터 정리 (개발 환경에서만 사용)
  await cleanDatabase();

  // 사용자 데이터 생성
  const users = await createUsers();
  console.log(`✅ ${users.length}명의 사용자 생성 완료`);

  // 카테고리 데이터 생성
  const categories = await createCategories();
  console.log(`✅ ${categories.length}개의 카테고리 생성 완료`);

  // 상품 데이터 생성
  const products = await createProducts(users, categories);
  console.log(`✅ ${products.length}개의 상품 생성 완료`);

  // 주문 데이터 생성
  const orders = await createOrders(users, products);
  console.log(`✅ ${orders.length}개의 주문 생성 완료`);

  // 즐겨찾기 데이터 생성
  const favorites = await createFavorites(users, products);
  console.log(`✅ ${favorites.length}개의 즐겨찾기 생성 완료`);

  console.log('🎉 시드 데이터 생성 완료!');
}

/**
 * 데이터베이스 정리
 */
async function cleanDatabase() {
  console.log('🧹 기존 데이터 정리 중...');

  // 순서대로 삭제 (외래키 제약조건 고려)
  await prisma.favorite.deleteMany();
  await prisma.review.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.chatRoomMember.deleteMany();
  await prisma.chatRoom.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  console.log('✅ 데이터 정리 완료');
}

/**
 * 사용자 데이터 생성
 */
async function createUsers() {
  const hashedPassword = await bcrypt.hash('password123', 10);

  const usersData = [
    {
      email: 'admin@test.com',
      password: hashedPassword,
      name: '관리자',
      nickname: 'admin',
      phoneNumber: '010-1234-5678',
      role: Role.ADMIN,
      emailVerified: true,
      phoneVerified: true,
      bio: '시스템 관리자입니다.',
      rating: 5.0,
      ratingCount: 100,
    },
    {
      email: 'seller1@test.com',
      password: hashedPassword,
      name: '김판매',
      nickname: 'seller1',
      phoneNumber: '010-2345-6789',
      role: Role.SELLER,
      emailVerified: true,
      phoneVerified: true,
      bio: '신뢰할 수 있는 판매자입니다.',
      rating: 4.8,
      ratingCount: 50,
    },
    {
      email: 'seller2@test.com',
      password: hashedPassword,
      name: '이거래',
      nickname: 'seller2',
      phoneNumber: '010-3456-7890',
      role: Role.SELLER,
      emailVerified: true,
      phoneVerified: true,
      bio: '빠른 배송과 친절한 응대를 약속합니다.',
      rating: 4.9,
      ratingCount: 75,
    },
    {
      email: 'buyer1@test.com',
      password: hashedPassword,
      name: '박구매',
      nickname: 'buyer1',
      phoneNumber: '010-4567-8901',
      role: Role.BUYER,
      emailVerified: true,
      phoneVerified: false,
      bio: '안전한 거래를 선호합니다.',
      rating: 4.5,
      ratingCount: 20,
    },
    {
      email: 'buyer2@test.com',
      password: hashedPassword,
      name: '최소비',
      nickname: 'buyer2',
      phoneNumber: '010-5678-9012',
      role: Role.BUYER,
      emailVerified: true,
      phoneVerified: true,
      bio: '좋은 물건을 찾고 있습니다.',
      rating: 4.7,
      ratingCount: 30,
    },
    {
      email: 'user1@test.com',
      password: hashedPassword,
      name: '정회원',
      nickname: 'user1',
      phoneNumber: '010-6789-0123',
      role: Role.USER,
      emailVerified: false,
      phoneVerified: false,
      bio: '처음 사용해봅니다.',
      rating: 0,
      ratingCount: 0,
    },
  ];

  const users = await Promise.all(
    usersData.map((userData) =>
      prisma.user.create({
        data: userData,
      })
    )
  );

  return users;
}

/**
 * 카테고리 데이터 생성
 */
async function createCategories() {
  // 대분류 카테고리
  const electronics = await prisma.category.create({
    data: {
      name: '전자제품',
      slug: 'electronics',
      icon: '💻',
      order: 1,
    },
  });

  const fashion = await prisma.category.create({
    data: {
      name: '패션/의류',
      slug: 'fashion',
      icon: '👕',
      order: 2,
    },
  });

  const furniture = await prisma.category.create({
    data: {
      name: '가구/인테리어',
      slug: 'furniture',
      icon: '🛋️',
      order: 3,
    },
  });

  const books = await prisma.category.create({
    data: {
      name: '도서/음반',
      slug: 'books',
      icon: '📚',
      order: 4,
    },
  });

  const sports = await prisma.category.create({
    data: {
      name: '스포츠/레저',
      slug: 'sports',
      icon: '⚽',
      order: 5,
    },
  });

  // 중분류 카테고리 (전자제품)
  const smartphones = await prisma.category.create({
    data: {
      name: '스마트폰',
      slug: 'smartphones',
      order: 1,
      parentId: electronics.id,
    },
  });

  const laptops = await prisma.category.create({
    data: {
      name: '노트북',
      slug: 'laptops',
      order: 2,
      parentId: electronics.id,
    },
  });

  const tablets = await prisma.category.create({
    data: {
      name: '태블릿',
      slug: 'tablets',
      order: 3,
      parentId: electronics.id,
    },
  });

  // 중분류 카테고리 (패션/의류)
  const mensClothing = await prisma.category.create({
    data: {
      name: '남성의류',
      slug: 'mens-clothing',
      order: 1,
      parentId: fashion.id,
    },
  });

  const womensClothing = await prisma.category.create({
    data: {
      name: '여성의류',
      slug: 'womens-clothing',
      order: 2,
      parentId: fashion.id,
    },
  });

  return [
    electronics,
    fashion,
    furniture,
    books,
    sports,
    smartphones,
    laptops,
    tablets,
    mensClothing,
    womensClothing,
  ];
}

/**
 * 상품 데이터 생성
 */
async function createProducts(users: any[], categories: any[]) {
  // 판매자만 필터링
  const sellers = users.filter((u) => u.role === 'SELLER' || u.role === 'ADMIN');

  // 카테고리 매핑 (이름으로 찾기)
  const getCategoryBySlug = (slug: string) =>
    categories.find((c) => c.slug === slug);

  const productsData = [
    // 전자제품
    {
      title: '아이폰 14 Pro 128GB 실버',
      description: '작년에 구매했고 거의 사용하지 않아서 상태 매우 좋습니다. 박스, 충전기 등 모든 구성품 포함되어 있습니다.',
      price: 950000,
      condition: ProductCondition.LIKE_NEW,
      status: ProductStatus.ACTIVE,
      categoryId: getCategoryBySlug('smartphones')?.id,
      sellerId: sellers[0].id,
      shippingAvailable: true,
      localPickup: true,
      location: '서울시 강남구',
      latitude: 37.4979,
      longitude: 127.0276,
      images: ['/images/iphone14-1.jpg', '/images/iphone14-2.jpg'],
      thumbnail: '/images/iphone14-1.jpg',
      viewCount: 125,
    },
    {
      title: '삼성 갤럭시북 프로 360 i7',
      description: '2022년 구매한 삼성 노트북입니다. 성능 좋고 터치스크린도 지원합니다. 가볍고 휴대성이 좋습니다.',
      price: 1200000,
      condition: ProductCondition.GOOD,
      status: ProductStatus.ACTIVE,
      categoryId: getCategoryBySlug('laptops')?.id,
      sellerId: sellers[1].id,
      shippingAvailable: true,
      localPickup: false,
      location: '서울시 서초구',
      latitude: 37.4833,
      longitude: 127.0322,
      images: ['/images/galaxybook-1.jpg'],
      thumbnail: '/images/galaxybook-1.jpg',
      viewCount: 89,
    },
    {
      title: '아이패드 프로 11인치 256GB',
      description: 'Apple Pencil 2세대 포함. 그래픽 작업용으로 사용했습니다. 케이스와 필름 부착되어 있습니다.',
      price: 850000,
      condition: ProductCondition.LIKE_NEW,
      status: ProductStatus.RESERVED,
      categoryId: getCategoryBySlug('tablets')?.id,
      sellerId: sellers[0].id,
      shippingAvailable: true,
      localPickup: true,
      location: '경기도 성남시',
      latitude: 37.4201,
      longitude: 127.1262,
      images: ['/images/ipad-1.jpg', '/images/ipad-2.jpg', '/images/ipad-3.jpg'],
      thumbnail: '/images/ipad-1.jpg',
      viewCount: 234,
    },
    {
      title: '맥북 에어 M1 8GB 256GB',
      description: '2021년 구매. 가볍고 배터리 수명 우수합니다. 학업용으로 사용했으며 흠집 없이 깨끗합니다.',
      price: 900000,
      condition: ProductCondition.GOOD,
      status: ProductStatus.ACTIVE,
      categoryId: getCategoryBySlug('laptops')?.id,
      sellerId: sellers[1].id,
      shippingAvailable: true,
      localPickup: true,
      location: '서울시 송파구',
      latitude: 37.5145,
      longitude: 127.1065,
      images: ['/images/macbook-1.jpg'],
      thumbnail: '/images/macbook-1.jpg',
      viewCount: 312,
    },
    // 패션/의류
    {
      title: '노스페이스 패딩 점퍼 (남성 L)',
      description: '작년 겨울 시즌에 구매한 노스페이스 패딩입니다. 따뜻하고 가볍습니다. 세탁 완료했습니다.',
      price: 180000,
      condition: ProductCondition.LIKE_NEW,
      status: ProductStatus.ACTIVE,
      categoryId: getCategoryBySlug('mens-clothing')?.id,
      sellerId: sellers[0].id,
      shippingAvailable: true,
      localPickup: true,
      location: '서울시 마포구',
      latitude: 37.5638,
      longitude: 126.9084,
      images: ['/images/padding-1.jpg'],
      thumbnail: '/images/padding-1.jpg',
      viewCount: 67,
    },
    {
      title: '자라 여성 코트 (55사이즈)',
      description: '올 시즌 자라 코트입니다. 한 번도 입지 않은 새 상품이며 태그 그대로 있습니다.',
      price: 120000,
      condition: ProductCondition.NEW,
      status: ProductStatus.ACTIVE,
      categoryId: getCategoryBySlug('womens-clothing')?.id,
      sellerId: sellers[1].id,
      shippingAvailable: true,
      localPickup: false,
      location: '인천시 남동구',
      latitude: 37.4482,
      longitude: 126.7315,
      images: ['/images/coat-1.jpg', '/images/coat-2.jpg'],
      thumbnail: '/images/coat-1.jpg',
      viewCount: 45,
    },
    {
      title: '나이키 에어포스 1 (270mm)',
      description: '클래식한 화이트 컬러 나이키 에어포스입니다. 2-3회 착용했습니다.',
      price: 95000,
      condition: ProductCondition.LIKE_NEW,
      status: ProductStatus.SOLD,
      categoryId: getCategoryBySlug('mens-clothing')?.id,
      sellerId: sellers[0].id,
      shippingAvailable: true,
      localPickup: true,
      location: '서울시 강남구',
      latitude: 37.4979,
      longitude: 127.0276,
      images: ['/images/shoes-1.jpg'],
      thumbnail: '/images/shoes-1.jpg',
      viewCount: 189,
      soldAt: new Date('2024-10-15'),
    },
  ];

  const validProducts = productsData.filter(p => p.categoryId);
  const products = await Promise.all(
    validProducts.map((productData) =>
      prisma.product.create({
        data: productData as any,
      })
    )
  );

  return products;
}

/**
 * 주문 데이터 생성
 */
async function createOrders(users: any[], products: any[]) {
  const buyers = users.filter((u) => u.role === 'BUYER' || u.role === 'USER');
  const soldProducts = products.filter((p) => p.status === 'SOLD');

  if (soldProducts.length === 0 || buyers.length === 0) {
    return [];
  }

  const ordersData = [
    {
      buyerId: buyers[0].id,
      sellerId: soldProducts[0].sellerId,
      productId: soldProducts[0].id,
      orderNumber: `ORD-${Date.now()}-001`,
      totalAmount: soldProducts[0].price + 3000,
      shippingFee: 3000,
      status: OrderStatus.CONFIRMED,
      recipientName: buyers[0].name,
      recipientPhone: buyers[0].phoneNumber,
      shippingAddress: '서울시 송파구 올림픽로 300',
      shippingPostcode: '05551',
      trackingNumber: 'CJ123456789',
      paymentMethod: PaymentMethod.CARD,
      paymentId: `PAY-${Date.now()}-001`,
      paidAt: new Date('2024-10-10'),
      confirmedAt: new Date('2024-10-15'),
      completedAt: new Date('2024-10-15'),
    },
  ];

  const orders = await Promise.all(
    ordersData.map((orderData) =>
      prisma.order.create({
        data: orderData as any,
      })
    )
  );

  return orders;
}

/**
 * 즐겨찾기 데이터 생성
 */
async function createFavorites(users: any[], products: any[]) {
  const buyers = users.filter((u) => u.role === 'BUYER' || u.role === 'USER');
  const activeProducts = products.filter((p) => p.status === 'ACTIVE');

  if (activeProducts.length === 0 || buyers.length === 0) {
    return [];
  }

  const favoritesData = [
    {
      userId: buyers[0].id,
      productId: activeProducts[0].id,
    },
    {
      userId: buyers[0].id,
      productId: activeProducts[1]?.id || activeProducts[0].id,
    },
    {
      userId: buyers[1]?.id || buyers[0].id,
      productId: activeProducts[0].id,
    },
  ];

  const validFavorites = favoritesData.filter(f => f.productId);
  const favoritesList: any[] = [];

  for (const favoriteData of validFavorites) {
    try {
      const favorite = await prisma.favorite.create({
        data: favoriteData,
      });
      favoritesList.push(favorite);
    } catch (error) {
      // 중복 즐겨찾기 무시
      console.log('중복 즐겨찾기 건너뛰기');
    }
  }

  return favoritesList;
}

// 스크립트 실행
main()
  .catch((e) => {
    console.error('❌ 시드 데이터 생성 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
