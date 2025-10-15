# Prisma ORM 마이그레이션 가이드

## 📋 개요

이 문서는 TypeORM에서 Prisma ORM으로 마이그레이션한 내역과 사용 방법을 설명합니다.

## 🔄 변경 사항

### 기존 (TypeORM)
```json
{
  "database": {
    "postgresql": "@nestjs/typeorm, pg, typeorm"
  }
}
```

### 변경 후 (Prisma)
```json
{
  "database": {
    "postgresql": "prisma, @prisma/client"
  }
}
```

## 📦 설치된 패키지

### 프로덕션 의존성
- `@prisma/client@^6.17.1` - Prisma 클라이언트 라이브러리
- `@nestjs/config@^4.0.2` - 환경 변수 관리

### 개발 의존성
- `prisma@^6.17.1` - Prisma CLI 및 마이그레이션 도구

## 🗂️ 프로젝트 구조

```
secondhand-api/
├── prisma/
│   └── schema.prisma          # Prisma 스키마 정의
├── src/
│   ├── prisma/
│   │   ├── prisma.module.ts   # Prisma 모듈
│   │   └── prisma.service.ts  # Prisma 서비스
│   └── app.module.ts          # 루트 모듈 (Prisma 모듈 임포트)
└── .env                       # 환경 변수 (DATABASE_URL)
```

## 📊 데이터베이스 스키마

### 정의된 모델

1. **User** - 사용자 정보
   - 역할: BUYER, SELLER, ADMIN
   - 상태: ACTIVE, INACTIVE, SUSPENDED, WITHDRAWN
   - 신뢰도 점수 관리

2. **Category** - 계층형 카테고리 (3단계)
   - 자기 참조 관계
   - slug 기반 URL

3. **Product** - 상품 정보
   - 위치 정보 (위도/경도)
   - 다중 이미지 지원
   - 상태: ON_SALE, RESERVED, SOLD_OUT, DELETED

4. **Order** - 주문 정보
   - 주문 번호 자동 생성
   - 배송 정보 관리
   - 상태: PENDING, PAID, SHIPPING, DELIVERED, CANCELLED, REFUNDED

5. **OrderItem** - 주문 상품
   - 구매 당시 가격 저장

6. **Payment** - 결제 정보
   - PG사 연동 정보
   - 결제/취소/환불 이력

7. **Shipment** - 배송 정보
   - 택배사 및 송장번호
   - 배송 상태 추적

8. **Review** - 리뷰 및 평점
   - 상품 및 판매자 평가
   - 1-5 평점 시스템

## 🚀 사용 방법

### 1. Prisma 클라이언트 생성

```bash
pnpx prisma generate
```

### 2. 마이그레이션 생성 및 적용

```bash
# 마이그레이션 파일 생성
pnpx prisma migrate dev --name init

# 프로덕션 마이그레이션 적용
pnpx prisma migrate deploy
```

### 3. Prisma Studio (데이터베이스 GUI)

```bash
pnpx prisma studio
```

### 4. 데이터베이스 초기화 (개발 환경)

```bash
pnpx prisma migrate reset
```

## 💻 코드 사용 예제

### NestJS 서비스에서 사용

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  // 사용자 생성
  async createUser(data: CreateUserDto) {
    return this.prisma.user.create({
      data: {
        email: data.email,
        password: data.password,
        name: data.name,
        role: 'BUYER',
      },
    });
  }

  // 사용자 조회
  async findUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        products: true,  // 판매 상품 포함
        orders: true,    // 주문 내역 포함
      },
    });
  }

  // 사용자 목록 조회 (페이지네이션)
  async findAllUsers(page: number, limit: number) {
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);

    return {
      data: users,
      total,
      page,
      limit,
    };
  }

  // 사용자 업데이트
  async updateUser(id: string, data: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  // 사용자 삭제
  async deleteUser(id: string) {
    return this.prisma.user.delete({
      where: { id },
    });
  }
}
```

### 트랜잭션 사용

```typescript
async createOrderWithPayment(orderData, paymentData) {
  return this.prisma.$transaction(async (prisma) => {
    // 주문 생성
    const order = await prisma.order.create({
      data: orderData,
    });

    // 결제 생성
    const payment = await prisma.payment.create({
      data: {
        ...paymentData,
        orderId: order.id,
      },
    });

    // 재고 감소
    await prisma.product.update({
      where: { id: orderData.productId },
      data: {
        stock: { decrement: orderData.quantity },
      },
    });

    return { order, payment };
  });
}
```

### 복잡한 쿼리

```typescript
// 상품 검색 (필터링, 정렬, 페이지네이션)
async searchProducts(params: SearchProductDto) {
  return this.prisma.product.findMany({
    where: {
      AND: [
        { status: 'ON_SALE' },
        params.categoryId ? { categoryId: params.categoryId } : {},
        params.minPrice ? { price: { gte: params.minPrice } } : {},
        params.maxPrice ? { price: { lte: params.maxPrice } } : {},
        params.keyword
          ? {
              OR: [
                { title: { contains: params.keyword, mode: 'insensitive' } },
                { description: { contains: params.keyword, mode: 'insensitive' } },
              ],
            }
          : {},
      ],
    },
    include: {
      category: true,
      seller: {
        select: {
          id: true,
          name: true,
          trustScore: true,
        },
      },
    },
    orderBy: params.sortBy
      ? { [params.sortBy]: params.sortOrder || 'desc' }
      : { createdAt: 'desc' },
    skip: (params.page - 1) * params.limit,
    take: params.limit,
  });
}
```

## 🔧 환경 변수 설정

### .env 파일

```env
# 데이터베이스 연결 URL
DATABASE_URL="postgresql://user:password@localhost:5432/secondhand_db?schema=public"

# Docker Compose 사용 시
DATABASE_URL="postgresql://postgres:postgres@postgres:5432/secondhand_db?schema=public"
```

## 📝 주요 차이점

### TypeORM vs Prisma

| 항목 | TypeORM | Prisma |
|------|---------|--------|
| 스키마 정의 | TypeScript 데코레이터 | Prisma Schema 언어 |
| 타입 안정성 | 런타임 검증 | 컴파일 타임 검증 |
| 마이그레이션 | CLI 또는 동기화 | Prisma Migrate |
| 쿼리 빌더 | QueryBuilder API | Fluent API |
| 관계 로딩 | Lazy/Eager Loading | Explicit Include |
| 성능 | 좋음 | 매우 좋음 |

## ✅ 장점

1. **타입 안정성**: TypeScript와 완벽한 통합
2. **개발자 경험**: 자동완성 및 IntelliSense 지원
3. **성능**: 최적화된 쿼리 생성
4. **마이그레이션**: 안전하고 명확한 마이그레이션 관리
5. **도구**: Prisma Studio로 데이터 시각화

## 🎯 다음 단계

1. 데이터베이스 마이그레이션 실행
2. Repository 패턴 구현
3. DTO 및 Validation 추가
4. 유닛 테스트 작성
5. E2E 테스트 작성

## 📚 참고 자료

- [Prisma 공식 문서](https://www.prisma.io/docs)
- [NestJS + Prisma 가이드](https://docs.nestjs.com/recipes/prisma)
- [Prisma Schema 참조](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Prisma Client API](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference)

---

**작성일**: 2025-10-15
**작성자**: 개발팀
**버전**: 1.0.0
