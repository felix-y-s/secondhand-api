# Prisma Schema onDelete 수정 가이드

## 📋 개요

현재 `Product.seller` 관계에서 `onDelete: Cascade` 설정으로 인해 판매자 계정 삭제 시 모든 상품이 함께 삭제되는 문제가 있습니다. 이는 거래 내역 보존과 구매자 보호 측면에서 부적절합니다.

**현재 문제:**
```prisma
model Product {
  seller User @relation(fields: [sellerId], references: [id], onDelete: Cascade)
  // ↑ 판매자 삭제 → 모든 상품 삭제 → 거래 내역 손실
}
```

**목표:**
- 판매자 계정 삭제 시 상품은 유지 (거래 내역 보존)
- 진행 중인 주문이 있으면 탈퇴 불가 (판매자/구매자 모두)
- 판매 중인 상품(`ACTIVE`)만 비활성화(`DELETED`) 처리
- 거래 완료된 상품(`RESERVED`, `SOLD`)과 주문/리뷰 데이터 보존

**핵심 변경사항:**
1. **삭제 정책 변경**: `onDelete: Cascade` → 소프트 삭제
2. **거래 보호**: 진행 중인 주문 확인 후 탈퇴 허용
3. **데이터 보존**: 과거 거래 기록 완전 보존

---

## 🔧 1단계: Prisma Schema 수정

### 1.1 Product 모델 수정

**파일:** `prisma/schema.prisma`

**변경 전:**
```prisma
model Product {
  id                String           @id @default(uuid())
  sellerId          String
  // ... 기타 필드
  seller            User             @relation(fields: [sellerId], references: [id], onDelete: Cascade)
}
```

**변경 후:**
```prisma
model Product {
  id                String           @id @default(uuid())
  sellerId          String
  // ... 기타 필드
  seller            User             @relation(fields: [sellerId], references: [id], onDelete: Restrict)
  //                                                                                ^^^^^^^^
  //                                                                        Cascade → Restrict 변경(자식 데이터가 남아 있는 한 부모 데이터는 삭제 불가)
}
```

### 1.2 User 모델 확인

**확인 사항:**
- User 모델에 `isActive` 필드가 이미 존재하는지 확인
- 현재 스키마에는 이미 `isActive Boolean @default(true)` 필드가 있음

```prisma
model User {
  /// 계정 활성화 여부 (탈퇴 시 false)
  isActive        Boolean          @default(true)
  // ✅ 이미 존재 - 추가 작업 불필요
}
```

---

## 🗄️ 2단계: 데이터베이스 마이그레이션

### 2.1 마이그레이션 생성

```bash
npx prisma migrate dev --name fix-product-seller-ondelete
```

**예상 마이그레이션 내용:**
```sql
-- AlterTable
ALTER TABLE "products" 
  DROP CONSTRAINT "products_sellerId_fkey",
  ADD CONSTRAINT "products_sellerId_fkey" 
    FOREIGN KEY ("sellerId") 
    REFERENCES "users"("id") 
    ON DELETE RESTRICT 
    ON UPDATE CASCADE;
```

### 2.2 마이그레이션 적용 전 체크리스트

✅ **사전 확인:**
1. 현재 DB 백업 완료
2. 개발 환경에서 먼저 테스트
3. 활성 상품이 있는 사용자 계정 삭제 시도 → Restrict 동작 확인

✅ **마이그레이션 적용:**
```bash
# 개발 환경
npx prisma migrate dev

# 프로덕션 환경
npx prisma migrate deploy
```

---

## 💻 3단계: 애플리케이션 레벨 소프트 삭제 구현

### 3.1 UsersService 수정

**파일:** `src/modules/users/users.service.ts`

**기존 코드:**
```typescript
async remove(id: string): Promise<User> {
  return this.usersRepository.delete(id);
  // ↑ 물리적 삭제 → 외래키 제약으로 실패
}
```

**수정 후 코드:**
```typescript
/**
 * 사용자 계정 삭제 (소프트 삭제)
 *
 * @description
 * - isActive를 false로 설정하여 논리적 삭제 수행
 * - 진행 중인 주문(판매자/구매자)이 있으면 삭제 불가
 * - 판매 중인 상품(ACTIVE)만 DELETED 상태로 변경
 * - 거래 완료된 상품(RESERVED, SOLD)과 주문/리뷰는 보존
 *
 * @param id - 삭제할 사용자 ID
 * @returns 삭제된 사용자 정보
 * @throws BadRequestException - 진행 중인 거래가 있는 경우
 */
async remove(id: string): Promise<User> {
  // 1. 사용자 존재 여부 확인
  const user = await this.usersRepository.findById(id);
  if (!user) {
    throw new NotFoundException('사용자를 찾을 수 없습니다');
  }

  // 2. 이미 삭제된 계정인지 확인
  if (!user.isActive) {
    throw new BadRequestException('이미 탈퇴한 계정입니다');
  }

  // 3. 진행 중인 주문 확인 (판매자/구매자 모두)
  const ongoingOrders = await this.prisma.order.findFirst({
    where: {
      OR: [
        { sellerId: id }, // 판매자로서의 주문
        { buyerId: id },  // 구매자로서의 주문
      ],
      status: {
        in: ['PENDING', 'PAID', 'SHIPPING', 'DELIVERED'], // 완료되지 않은 주문
      },
    },
  });

  if (ongoingOrders) {
    throw new BadRequestException(
      '진행 중인 거래가 있어 탈퇴할 수 없습니다. 모든 거래를 완료하거나 취소해주세요.'
    );
  }

  // 4. 트랜잭션으로 소프트 삭제 수행
  return this.prisma.$transaction(async (prisma) => {
    // 4-1. 판매 중인 상품만 DELETED 상태로 변경
    // (RESERVED, SOLD 상태는 이미 거래 완료된 것이므로 유지)
    await prisma.product.updateMany({
      where: {
        sellerId: id,
        status: 'ACTIVE', // 판매 중인 상품만 삭제
      },
      data: {
        status: 'DELETED',
      },
    });

    // 4-2. 사용자 계정 비활성화
    return prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        // 선택적: 개인정보 마스킹 (GDPR 준수)
        // email: `deleted_${id}@deleted.com`,
        // phoneNumber: null,
        // profileImage: null,
        // bio: null,
      },
    });
  });
}
```

### 3.2 비즈니스 로직 상세 설명

#### 왜 진행 중인 주문을 확인해야 하나?

**문제 시나리오:**
1. **판매자가 탈퇴하려는 경우**
   - 상품이 예약됨(`RESERVED`) 또는 판매완료(`SOLD`) 상태
   - 주문이 결제완료(`PAID`), 배송중(`SHIPPING`), 배송완료(`DELIVERED`) 상태
   - 탈퇴 시 구매자가 상품을 받지 못하거나 환불/분쟁 발생

2. **구매자가 탈퇴하려는 경우**
   - 주문이 대기중(`PENDING`), 결제완료(`PAID`) 상태
   - 탈퇴 시 판매자가 배송할 수 없거나 대금을 받지 못함

**해결 방안:**
- 진행 중인 주문 상태(`PENDING`, `PAID`, `SHIPPING`, `DELIVERED`) 확인
- 판매자/구매자 모두 진행 중인 거래가 없을 때만 탈퇴 허용
- 거래 완료(`COMPLETED`) 또는 취소(`CANCELLED`)된 주문만 있으면 탈퇴 가능

#### 상품 상태별 처리 전략

| 상품 상태 | 탈퇴 시 처리 | 이유 |
|----------|-----------|------|
| `ACTIVE` | `DELETED`로 변경 | 판매 중인 상품이므로 삭제 |
| `RESERVED` | **유지** | 거래 진행 중이므로 보존 필요 |
| `SOLD` | **유지** | 거래 완료되었으므로 기록 보존 |
| `DELETED` | 변경 없음 | 이미 삭제된 상품 |

#### 주문 상태별 탈퇴 가능 여부

| 주문 상태 | 탈퇴 가능 | 이유 |
|----------|---------|------|
| `PENDING` | ❌ 불가 | 주문 대기 중 |
| `PAID` | ❌ 불가 | 결제 완료, 배송 대기 |
| `SHIPPING` | ❌ 불가 | 배송 중 |
| `DELIVERED` | ❌ 불가 | 배송 완료, 거래 확정 대기 |
| `COMPLETED` | ✅ 가능 | 거래 완료됨 |
| `CANCELLED` | ✅ 가능 | 거래 취소됨 |

### 3.3 필요한 import 추가

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
```

### 3.4 UsersRepository 수정 (선택 사항)

**파일:** `src/modules/users/repositories/users.repository.ts`

기존 `delete` 메서드를 소프트 삭제로 변경하거나, 새로운 `softDelete` 메서드 추가:

```typescript
/**
 * 사용자 소프트 삭제
 */
async softDelete(id: string): Promise<User> {
  return this.prisma.user.update({
    where: { id },
    data: { isActive: false },
  });
}

/**
 * 사용자 물리적 삭제 (관리자 전용)
 */
async hardDelete(id: string): Promise<User> {
  return this.prisma.user.delete({
    where: { id },
  });
}
```

---

## 🧪 4단계: 테스트 작성

### 4.1 통합 테스트 추가

**파일:** `src/modules/users/users.service.integration.spec.ts`

```typescript
describe('UsersService - 계정 삭제', () => {
  it('판매자 계정 삭제 시 상품이 DELETED 상태로 변경되어야 함', async () => {
    // Given: 상품이 있는 판매자 생성
    const seller = await usersService.create({
      email: 'seller@test.com',
      password: 'password123',
      nickname: 'seller',
    });

    const product = await productsService.create(seller.id, {
      title: '테스트 상품',
      price: 10000,
      condition: 'GOOD',
      categoryId: testCategoryId,
      description: '테스트',
    });

    // When: 판매자 계정 삭제
    await usersService.remove(seller.id);

    // Then: 판매자는 비활성화됨
    const deletedSeller = await usersService.findById(seller.id);
    expect(deletedSeller.isActive).toBe(false);

    // Then: 상품은 DELETED 상태로 변경됨
    const deletedProduct = await productsService.findById(product.id);
    expect(deletedProduct.status).toBe('DELETED');
  });

  it('구매 내역이 있는 판매자 삭제 시 주문 내역이 보존되어야 함', async () => {
    // Given: 판매자, 구매자, 상품, 주문 생성
    const seller = await usersService.create({
      email: 'seller2@test.com',
      password: 'password123',
      nickname: 'seller2',
    });

    const buyer = await usersService.create({
      email: 'buyer@test.com',
      password: 'password123',
      nickname: 'buyer',
    });

    const product = await productsService.create(seller.id, {
      title: '판매된 상품',
      price: 20000,
      condition: 'NEW',
      categoryId: testCategoryId,
      description: '테스트',
    });

    const order = await ordersService.create({
      buyerId: buyer.id,
      productId: product.id,
      // ... 기타 주문 정보
    });

    // When: 판매자 계정 삭제
    await usersService.remove(seller.id);

    // Then: 주문 내역은 보존됨
    const preservedOrder = await ordersService.findById(order.id);
    expect(preservedOrder).toBeDefined();
    expect(preservedOrder.sellerId).toBe(seller.id);
  });

  it('이미 삭제된 계정 재삭제 시 에러 발생', async () => {
    // Given: 삭제된 사용자
    const user = await usersService.create({
      email: 'test@test.com',
      password: 'password123',
      nickname: 'test',
    });
    await usersService.remove(user.id);

    // When & Then: 재삭제 시도 시 에러
    await expect(usersService.remove(user.id)).rejects.toThrow(
      '이미 탈퇴한 계정입니다',
    );
  });

  it('진행 중인 주문이 있는 판매자는 탈퇴 불가', async () => {
    // Given: 판매자, 구매자, 상품, 진행 중인 주문 생성
    const seller = await usersService.create({
      email: 'seller3@test.com',
      password: 'password123',
      nickname: 'seller3',
    });

    const buyer = await usersService.create({
      email: 'buyer2@test.com',
      password: 'password123',
      nickname: 'buyer2',
    });

    const product = await productsService.create(seller.id, {
      title: '진행 중인 상품',
      price: 15000,
      condition: 'GOOD',
      categoryId: testCategoryId,
      description: '테스트',
    });

    await ordersService.create({
      buyerId: buyer.id,
      productId: product.id,
      status: 'PAID', // 결제 완료 상태
    });

    // When & Then: 판매자 탈퇴 시도 시 에러
    await expect(usersService.remove(seller.id)).rejects.toThrow(
      '진행 중인 거래가 있어 탈퇴할 수 없습니다',
    );
  });

  it('진행 중인 주문이 있는 구매자는 탈퇴 불가', async () => {
    // Given: 판매자, 구매자, 상품, 진행 중인 주문 생성
    const seller = await usersService.create({
      email: 'seller4@test.com',
      password: 'password123',
      nickname: 'seller4',
    });

    const buyer = await usersService.create({
      email: 'buyer3@test.com',
      password: 'password123',
      nickname: 'buyer3',
    });

    const product = await productsService.create(seller.id, {
      title: '구매 중인 상품',
      price: 25000,
      condition: 'NEW',
      categoryId: testCategoryId,
      description: '테스트',
    });

    await ordersService.create({
      buyerId: buyer.id,
      productId: product.id,
      status: 'SHIPPING', // 배송 중 상태
    });

    // When & Then: 구매자 탈퇴 시도 시 에러
    await expect(usersService.remove(buyer.id)).rejects.toThrow(
      '진행 중인 거래가 있어 탈퇴할 수 없습니다',
    );
  });

  it('완료된 주문만 있는 경우 탈퇴 가능', async () => {
    // Given: 판매자, 구매자, 상품, 완료된 주문 생성
    const seller = await usersService.create({
      email: 'seller5@test.com',
      password: 'password123',
      nickname: 'seller5',
    });

    const buyer = await usersService.create({
      email: 'buyer4@test.com',
      password: 'password123',
      nickname: 'buyer4',
    });

    const product = await productsService.create(seller.id, {
      title: '완료된 상품',
      price: 30000,
      condition: 'LIKE_NEW',
      categoryId: testCategoryId,
      description: '테스트',
    });

    await ordersService.create({
      buyerId: buyer.id,
      productId: product.id,
      status: 'COMPLETED', // 거래 완료 상태
    });

    // When: 판매자 탈퇴
    await usersService.remove(seller.id);

    // Then: 정상적으로 탈퇴됨
    const deletedSeller = await usersService.findById(seller.id);
    expect(deletedSeller.isActive).toBe(false);
  });
});
```

### 4.2 E2E 테스트 추가

**파일:** `test/users.e2e-spec.ts`

```typescript
describe('DELETE /users/me - 계정 삭제', () => {
  it('본인 계정 삭제 시 상품이 DELETED 상태로 변경됨', async () => {
    // Given: 로그인 및 상품 등록
    const loginRes = await request(app.getHttpServer())
      .post('/users/login')
      .send({ email: 'seller@test.com', password: 'password123' });

    const token = loginRes.body.data.accessToken;

    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: '테스트 상품',
        price: 10000,
        condition: 'GOOD',
        categoryId: testCategoryId,
        description: '테스트',
      });

    // When: 계정 삭제
    await request(app.getHttpServer())
      .delete('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Then: 상품 조회 시 DELETED 상태
    const products = await request(app.getHttpServer())
      .get('/products')
      .expect(200);

    expect(products.body.data.items).toHaveLength(0); // 활성 상품 목록에는 없음
  });
});
```

---

## ✅ 5단계: 검증 체크리스트

### 5.1 기능 검증

- [ ] 판매자 계정 삭제 시 `isActive = false`로 변경됨
- [ ] 판매 중인 상품(`ACTIVE`)만 `status = DELETED`로 변경됨
- [ ] 거래 완료된 상품(`RESERVED`, `SOLD`)은 유지됨
- [ ] 기존 주문 내역이 보존됨 (sellerId, buyerId 유지)
- [ ] 기존 리뷰 내역이 보존됨
- [ ] 채팅 메시지 내역이 보존됨
- [ ] 이미 삭제된 계정 재삭제 시 적절한 에러 발생
- [ ] 진행 중인 주문(`PENDING`, `PAID`, `SHIPPING`, `DELIVERED`)이 있으면 탈퇴 불가
- [ ] 완료/취소된 주문(`COMPLETED`, `CANCELLED`)만 있으면 탈퇴 가능
- [ ] 판매자/구매자 모두 진행 중인 거래 확인됨

### 5.2 데이터 무결성 검증

```sql
-- 1. 삭제된 사용자 확인
SELECT id, email, isActive FROM users WHERE isActive = false;

-- 2. 삭제된 사용자의 상품 상태 확인 (ACTIVE 상품만 DELETED로 변경되었는지)
SELECT p.id, p.title, p.status, p.sellerId, u.isActive as sellerActive
FROM products p
JOIN users u ON p.sellerId = u.id
WHERE u.isActive = false;
-- 결과: ACTIVE 상품은 DELETED, RESERVED/SOLD는 유지

-- 3. 삭제된 사용자의 주문 내역 확인 (보존되어야 함)
SELECT o.id, o.orderNumber, o.status, o.sellerId, u.isActive as sellerActive
FROM orders o
JOIN users u ON o.sellerId = u.id
WHERE u.isActive = false;
-- 결과: 모든 주문 내역 보존됨

-- 4. 진행 중인 주문이 있는 사용자 확인 (탈퇴 불가 대상)
SELECT u.id, u.email, o.status, o.orderNumber
FROM users u
JOIN orders o ON (u.id = o.sellerId OR u.id = o.buyerId)
WHERE u.isActive = true
  AND o.status IN ('PENDING', 'PAID', 'SHIPPING', 'DELIVERED')
GROUP BY u.id, u.email, o.status, o.orderNumber;
-- 결과: 이 사용자들은 탈퇴 불가

-- 5. 탈퇴 가능한 사용자 확인 (진행 중인 주문 없음)
SELECT u.id, u.email, u.isActive
FROM users u
LEFT JOIN orders o ON (u.id = o.sellerId OR u.id = o.buyerId)
  AND o.status IN ('PENDING', 'PAID', 'SHIPPING', 'DELIVERED')
WHERE u.isActive = true
  AND o.id IS NULL;
-- 결과: 탈퇴 가능한 사용자 목록
```

### 5.3 성능 검증

- [ ] 상품이 많은 판매자 삭제 시 트랜잭션 성능 확인 (>1000개 상품)
- [ ] 동시 다발적 계정 삭제 요청 처리 확인

---

## 🚨 6단계: 추가 고려사항

### 6.1 UI/UX 개선

**삭제된 판매자 표시:**
```typescript
// ProductResponseDto에 판매자 상태 포함
export class ProductResponseDto {
  @ApiProperty({ example: 'uuid', description: '판매자 ID' })
  sellerId: string;

  @ApiProperty({ 
    example: false, 
    description: '판매자 계정 활성화 여부' 
  })
  sellerIsActive: boolean; // ← 추가

  @ApiProperty({ 
    example: '탈퇴한 사용자', 
    description: '판매자 닉네임 (탈퇴 시 마스킹)' 
  })
  sellerNickname: string;
}
```

### 6.2 관리자 기능 추가

**물리적 삭제 엔드포인트 (관리자 전용):**
```typescript
// src/modules/users/users.controller.ts
@Delete('admin/hard-delete/:id')
@ApiBearerAuth('access-token')
@ApiOperation({ 
  summary: '사용자 물리적 삭제 (관리자 전용)',
  description: '주의: 모든 관련 데이터가 삭제됩니다' 
})
async hardDelete(@Param('id') id: string) {
  // 관리자 권한 체크
  // 물리적 삭제 수행
}
```

### 6.3 개인정보 보호 강화

**계정 삭제 시 개인정보 마스킹:**
```typescript
// UsersService.remove() 트랜잭션 내부
return prisma.user.update({
  where: { id },
  data: {
    isActive: false,
    email: `deleted_${id}@deleted.com`,
    phoneNumber: null,
    profileImage: null,
    bio: null,
    name: null,
  },
});
```

### 6.4 복구 기능 추가 (선택 사항)

**계정 복구 엔드포인트:**
```typescript
async restore(id: string): Promise<User> {
  return this.prisma.$transaction(async (prisma) => {
    // 계정 복구
    const user = await prisma.user.update({
      where: { id },
      data: { isActive: true },
    });

    // 상품은 복구하지 않음 (수동으로 재등록 유도)
    // 또는 일부 상품만 복구 가능하도록 구현

    return user;
  });
}
```

---

## 📝 7단계: 마이그레이션 롤백 계획

**문제 발생 시 롤백 방법:**

```bash
# 1. 마이그레이션 상태 확인
npx prisma migrate status

# 2. 롤백 (마지막 마이그레이션 취소)
npx prisma migrate resolve --rolled-back <migration-name>

# 3. 이전 마이그레이션 재적용
npx prisma migrate deploy
```

**수동 롤백 SQL:**
```sql
-- Restrict를 다시 Cascade로 변경 (권장하지 않음)
ALTER TABLE "products" 
  DROP CONSTRAINT "products_sellerId_fkey",
  ADD CONSTRAINT "products_sellerId_fkey" 
    FOREIGN KEY ("sellerId") 
    REFERENCES "users"("id") 
    ON DELETE CASCADE 
    ON UPDATE CASCADE;
```

---

## 🎯 작업 순서 요약

1. ✅ **Schema 수정**: `onDelete: Cascade` → `onDelete: Restrict`
2. ✅ **마이그레이션**: `npx prisma migrate dev --name fix-product-seller-ondelete`
3. ✅ **Service 수정**: `UsersService.remove()` 메서드를 소프트 삭제로 변경
4. ✅ **테스트 작성**: 통합 테스트 및 E2E 테스트 추가
5. ✅ **검증**: 체크리스트 항목 확인
6. ✅ **배포**: 개발 → 스테이징 → 프로덕션 순차 적용

---

## ⚠️ 주의사항

1. **프로덕션 배포 전 반드시 백업**
2. **개발 환경에서 충분히 테스트 후 적용**
3. **기존 사용자 데이터 영향도 분석**
4. **모니터링 강화**: 계정 삭제 요청 추이, 에러 로그 확인

---

## 📚 참고 자료

- [Prisma Referential Actions](https://www.prisma.io/docs/concepts/components/prisma-schema/relations/referential-actions)
- [NestJS Transaction](https://docs.nestjs.com/recipes/prisma#transactions)
- [Soft Delete Pattern](https://www.prisma.io/docs/guides/database/advanced-database-tasks/soft-deletion)
