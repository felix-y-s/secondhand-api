# 데이터베이스 설계 문서

## 개요

중고거래 플랫폼 API의 데이터베이스 스키마 설계 문서입니다.

**데이터베이스**: PostgreSQL
**ORM**: Prisma
**스키마 버전**: v1.0.0 (Phase 2)
**마지막 업데이트**: 2025-10-18

## 목차

1. [ERD 다이어그램](#erd-다이어그램)
2. [도메인 모델](#도메인-모델)
   1. [User](#1-user-사용자)
   2. [Category](#2-category-카테고리)
   3. [Product](#3-product-상품)
   4. [Order](#4-order-주문)
   5. [Review](#5-review-리뷰)
   6. [Chatroom](#6-chatroom-채팅방)
   7. [ChatroomMember](#7-chatroommember-채팅방-참여자)
   8. [ChatMessage](#8-chatmessage-채팅-메시지)
   9. [Favorite](#9-favorite-찜하기)
   10. [Notification](#10-notification-알림)
3. [Enum 타입](#enum-타입)
4. [인덱스 전략](#인덱스-전략)
5. [관계 설정](#관계-설정)
6. [비즈니스 규칙](#비즈니스-규칙)

---

## ERD 다이어그램

ERD 다이어그램은 `prisma/ERD.svg` 파일에서 확인할 수 있습니다.

```bash
# ERD 재생성
npx prisma generate
```

---

## 도메인 모델

### 1. User (사용자)

**테이블명**: `users`

**필드**:

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | String | PK, UUID | 사용자 고유 ID |
| email | String | UNIQUE, NOT NULL | 이메일 (로그인용) |
| password | String | NOT NULL | 암호화된 비밀번호 |
| name | String | NULLABLE | 실명 |
| nickname | String | UNIQUE, NOT NULL | 닉네임 (표시명) |
| phoneNumber | String | UNIQUE, NULLABLE | 전화번호 |
| profileImage | String | NULLABLE | 프로필 이미지 URL |
| bio | Text | NULLABLE | 자기소개 |
| role | Role | NOT NULL, DEFAULT: USER | 사용자 역할 |
| emailVerified | Boolean | DEFAULT: false | 이메일 인증 여부 |
| phoneVerified | Boolean | DEFAULT: false | 전화번호 인증 여부 |
| isActive | Boolean | DEFAULT: true | 계정 활성화 여부 |
| rating | Float | DEFAULT: 0 | 평균 평점 |
| ratingCount | Int | DEFAULT: 0 | 받은 리뷰 수 |
| createdAt | DateTime | DEFAULT: now() | 생성일시 |
| updatedAt | DateTime | AUTO | 수정일시 |
| lastLoginAt | DateTime | NULLABLE | 마지막 로그인 일시 |

**인덱스**:
- `email` (로그인 조회)
- `role` (역할별 필터링)
- `createdAt` (가입일 기준 정렬)

**관계**:
- `products`: 1:N (판매 상품)
- `orders`: 1:N (구매 주문)
- `sales`: 1:N (판매 주문)
- `reviews`: 1:N (작성 리뷰)
- `receivedReviews`: 1:N (받은 리뷰)
- `chatRooms`: N:M (채팅방 참여)
- `messages`: 1:N (채팅 메시지)
- `favorites`: 1:N (찜한 상품)
- `notifications`: 1:N (알림)

---

### 2. Category (카테고리)

**테이블명**: `categories`

**필드**:

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | String | PK, UUID | 카테고리 고유 ID |
| name | String | UNIQUE, NOT NULL | 카테고리명 |
| slug | String | UNIQUE, NOT NULL | URL용 슬러그 |
| icon | String | NULLABLE | 아이콘 이미지 URL |
| order | Int | DEFAULT: 0 | 표시 순서 |
| isActive | Boolean | DEFAULT: true | 활성화 여부 |
| parentId | String | NULLABLE | 부모 카테고리 ID |
| createdAt | DateTime | DEFAULT: now() | 생성일시 |
| updatedAt | DateTime | AUTO | 수정일시 |

**인덱스**:
- `parentId` (계층 구조 조회)
- `slug` (URL 라우팅)

**관계**:
- `parent`: N:1 (부모 카테고리)
- `children`: 1:N (하위 카테고리)
- `products`: 1:N (상품)

**계층 구조**:
```
전자제품 (parentId: null)
  ├─ 스마트폰 (parentId: 전자제품.id)
  ├─ 노트북 (parentId: 전자제품.id)
  └─ 태블릿 (parentId: 전자제품.id)
```

---

### 3. Product (상품)

**테이블명**: `products`

**필드**:

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | String | PK, UUID | 상품 고유 ID |
| sellerId | String | FK, NOT NULL | 판매자 ID |
| categoryId | String | FK, NOT NULL | 카테고리 ID |
| title | String(100) | NOT NULL | 상품 제목 |
| description | Text | NOT NULL | 상품 설명 |
| price | Int | NOT NULL | 가격 (원) |
| condition | ProductCondition | NOT NULL | 상품 상태 |
| status | ProductStatus | DEFAULT: ACTIVE | 판매 상태 |
| shippingAvailable | Boolean | DEFAULT: false | 택배 가능 여부 |
| localPickup | Boolean | DEFAULT: true | 직거래 가능 여부 |
| location | String | NULLABLE | 거래 위치 |
| latitude | Float | NULLABLE | 위도 |
| longitude | Float | NULLABLE | 경도 |
| images | String[] | DEFAULT: [] | 이미지 URL 배열 |
| thumbnail | String | NULLABLE | 썸네일 URL |
| viewCount | Int | DEFAULT: 0 | 조회수 |
| createdAt | DateTime | DEFAULT: now() | 등록일시 |
| updatedAt | DateTime | AUTO | 수정일시 |
| soldAt | DateTime | NULLABLE | 판매완료 일시 |

**인덱스**:
- `sellerId` (판매자별 조회)
- `categoryId` (카테고리별 조회)
- `status` (상태별 필터링)
- `createdAt` (최신순 정렬)
- `price` (가격 범위 검색)
- `(status, createdAt)` (복합: 판매중 상품 최신순)
- `(categoryId, status)` (복합: 카테고리 내 판매중 상품)
- `(latitude, longitude)` (복합: 위치 기반 검색)

**관계**:
- `seller`: N:1 (판매자)
- `category`: N:1 (카테고리)
- `orders`: 1:N (주문)
- `favorites`: 1:N (찜)

---

### 4. Order (주문)

**테이블명**: `orders`

**필드**:

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | String | PK, UUID | 주문 고유 ID |
| buyerId | String | FK, NOT NULL | 구매자 ID |
| sellerId | String | FK, NOT NULL | 판매자 ID |
| productId | String | FK, NOT NULL | 상품 ID |
| orderNumber | String | UNIQUE, NOT NULL | 주문번호 |
| totalAmount | Int | NOT NULL | 총 금액 |
| shippingFee | Int | DEFAULT: 0 | 배송비 |
| status | OrderStatus | DEFAULT: PENDING | 주문 상태 |
| recipientName | String | NULLABLE | 수령인명 |
| recipientPhone | String | NULLABLE | 수령인 전화번호 |
| shippingAddress | String | NULLABLE | 배송 주소 |
| shippingPostcode | String | NULLABLE | 우편번호 |
| trackingNumber | String | NULLABLE | 송장번호 |
| paymentMethod | PaymentMethod | NULLABLE | 결제 수단 |
| paymentId | String | UNIQUE, NULLABLE | 결제 ID |
| paidAt | DateTime | NULLABLE | 결제 완료 일시 |
| createdAt | DateTime | DEFAULT: now() | 주문 생성일시 |
| updatedAt | DateTime | AUTO | 수정일시 |
| confirmedAt | DateTime | NULLABLE | 구매 확정일시 |
| completedAt | DateTime | NULLABLE | 주문 완료일시 |
| cancelledAt | DateTime | NULLABLE | 취소일시 |

**인덱스**:
- `buyerId` (구매자별 조회)
- `sellerId` (판매자별 조회)
- `productId` (상품별 조회)
- `status` (상태별 필터링)

**관계**:
- `buyer`: N:1 (구매자)
- `seller`: N:1 (판매자)
- `product`: N:1 (상품)
- `review`: 1:1 (리뷰)

---

### 5. Review (리뷰)

**테이블명**: `reviews`

**필드**:

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | String | PK, UUID | 리뷰 고유 ID |
| orderId | String | UNIQUE, FK, NOT NULL | 주문 ID |
| reviewerId | String | FK, NOT NULL | 작성자 ID |
| reviewedId | String | FK, NOT NULL | 대상자 ID |
| rating | Int | NOT NULL | 별점 (1-5) |
| comment | Text | NULLABLE | 리뷰 내용 |
| createdAt | DateTime | DEFAULT: now() | 작성일시 |
| updatedAt | DateTime | AUTO | 수정일시 |

**인덱스**:
- `reviewerId` (작성자별 조회)
- `reviewedId` (대상자별 조회)

**관계**:
- `order`: N:1 (주문)
- `reviewer`: N:1 (작성자)
- `reviewed`: N:1 (대상자)

---

### 6. ChatRoom (채팅방)

**테이블명**: `chat_rooms`

**필드**:

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | String | PK, UUID | 채팅방 고유 ID |
| productId | String | NULLABLE | 관련 상품 ID |
| createdAt | DateTime | DEFAULT: now() | 생성일시 |
| updatedAt | DateTime | AUTO | 수정일시 |

**관계**:
- `members`: 1:N (참여자)
- `messages`: 1:N (메시지)

---

### 7. ChatRoomMember (채팅방 참여자)

**테이블명**: `chat_room_members`

**필드**:

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | String | PK, UUID | 참여 정보 고유 ID |
| chatRoomId | String | FK, NOT NULL | 채팅방 ID |
| userId | String | FK, NOT NULL | 사용자 ID |
| lastReadAt | DateTime | NULLABLE | 마지막 읽은 시간 |
| joinedAt | DateTime | DEFAULT: now() | 참여일시 |

**복합 Unique 제약조건**:
- `(chatRoomId, userId)`: 한 사용자는 동일 채팅방에 한 번만 참여

**관계**:
- `chatRoom`: N:1 (채팅방)
- `user`: N:1 (사용자)

---

### 8. ChatMessage (채팅 메시지)

**테이블명**: `chat_messages`

**필드**:

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | String | PK, UUID | 메시지 고유 ID |
| chatRoomId | String | FK, NOT NULL | 채팅방 ID |
| senderId | String | FK, NOT NULL | 발신자 ID |
| content | Text | NOT NULL | 메시지 내용 |
| messageType | MessageType | DEFAULT: TEXT | 메시지 타입 |
| fileUrl | String | NULLABLE | 파일 URL |
| fileName | String | NULLABLE | 파일명 |
| isRead | Boolean | DEFAULT: false | 읽음 여부 |
| readAt | DateTime | NULLABLE | 읽은 시간 |
| createdAt | DateTime | DEFAULT: now() | 전송일시 |

**인덱스**:
- `chatRoomId` (채팅방별 조회)
- `senderId` (발신자별 조회)

**관계**:
- `chatRoom`: N:1 (채팅방)
- `sender`: N:1 (발신자)

---

### 9. Favorite (찜하기)

**테이블명**: `favorites`

**필드**:

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | String | PK, UUID | 찜 고유 ID |
| userId | String | FK, NOT NULL | 사용자 ID |
| productId | String | FK, NOT NULL | 상품 ID |
| createdAt | DateTime | DEFAULT: now() | 찜한 일시 |

**복합 Unique 제약조건**:
- `(userId, productId)`: 한 사용자는 동일 상품을 한 번만 찜

**인덱스**:
- `userId` (사용자별 조회)
- `productId` (상품별 조회)

**관계**:
- `user`: N:1 (사용자)
- `product`: N:1 (상품)

---

### 10. Notification (알림)

**테이블명**: `notifications`

**필드**:

| 필드명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| id | String | PK, UUID | 알림 고유 ID |
| userId | String | FK, NOT NULL | 사용자 ID |
| type | NotificationType | NOT NULL | 알림 타입 |
| title | String | NOT NULL | 알림 제목 |
| message | Text | NOT NULL | 알림 내용 |
| relatedId | String | NULLABLE | 관련 엔티티 ID |
| relatedType | String | NULLABLE | 관련 엔티티 타입 |
| isRead | Boolean | DEFAULT: false | 읽음 여부 |
| readAt | DateTime | NULLABLE | 읽은 시간 |
| createdAt | DateTime | DEFAULT: now() | 생성일시 |

**인덱스**:
- `userId` (사용자별 조회)
- `isRead` (읽지 않은 알림 조회)

**관계**:
- `user`: N:1 (사용자)

---

## Enum 타입

### Role (사용자 역할)

```prisma
enum Role {
  ADMIN   // 관리자 (시스템 전체 관리)
  USER    // 일반 사용자
  SELLER  // 판매자
  BUYER   // 구매자
  GUEST   // 게스트 (제한된 권한)
}
```

**설명**:
- Phase 1 RBAC 시스템과 동기화
- 사용자는 하나의 역할만 가짐
- 역할별 권한은 애플리케이션 레벨에서 관리

---

### ProductCondition (상품 상태)

```prisma
enum ProductCondition {
  NEW          // 새 상품
  LIKE_NEW     // 거의 새것
  GOOD         // 좋음
  FAIR         // 보통
  POOR         // 나쁨
}
```

---

### ProductStatus (판매 상태)

```prisma
enum ProductStatus {
  ACTIVE       // 판매중
  RESERVED     // 예약중
  SOLD         // 판매완료
  DELETED      // 삭제됨
}
```

**상태 전환 규칙**:
```
ACTIVE → RESERVED → SOLD
   ↓
DELETED (복구 불가)
```

---

### OrderStatus (주문 상태)

```prisma
enum OrderStatus {
  PENDING          // 주문 대기
  PAYMENT_PENDING  // 결제 대기
  PAID             // 결제 완료
  SHIPPING         // 배송중
  DELIVERED        // 배송 완료
  CONFIRMED        // 구매 확정
  CANCELLED        // 주문 취소
  REFUNDED         // 환불 완료
}
```

**상태 전환 플로우**:
```
PENDING → PAYMENT_PENDING → PAID → SHIPPING → DELIVERED → CONFIRMED
   ↓                          ↓         ↓
CANCELLED                  CANCELLED  CANCELLED → REFUNDED
```

---

### PaymentMethod (결제 수단)

```prisma
enum PaymentMethod {
  CARD             // 신용카드
  BANK_TRANSFER    // 계좌이체
  VIRTUAL_ACCOUNT  // 가상계좌
  KAKAOPAY         // 카카오페이
  TOSSPAY          // 토스페이
  MEET_IN_PERSON   // 직거래
}
```

---

### MessageType (메시지 타입)

```prisma
enum MessageType {
  TEXT    // 텍스트
  IMAGE   // 이미지
  FILE    // 파일
  SYSTEM  // 시스템 메시지
}
```

---

### NotificationType (알림 타입)

```prisma
enum NotificationType {
  PRODUCT_LIKED      // 상품 찜
  NEW_MESSAGE        // 새 메시지
  ORDER_CREATED      // 주문 생성
  ORDER_CONFIRMED    // 주문 확정
  ORDER_CANCELLED    // 주문 취소
  PAYMENT_COMPLETED  // 결제 완료
  REVIEW_RECEIVED    // 리뷰 받음
  SYSTEM             // 시스템 알림
}
```

---

## 인덱스 전략

### 단일 컬럼 인덱스

**User**:
- `email`: 로그인 조회 (빈도 높음)
- `role`: 역할별 필터링
- `createdAt`: 가입일 기준 정렬

**Category**:
- `parentId`: 계층 구조 조회
- `slug`: URL 라우팅

**Product**:
- `sellerId`: 판매자별 상품 조회
- `categoryId`: 카테고리별 상품 조회
- `status`: 판매 상태별 필터링
- `createdAt`: 최신순 정렬
- `price`: 가격 범위 검색

**Order**:
- `buyerId`: 구매자 주문 내역
- `sellerId`: 판매자 주문 내역
- `productId`: 상품별 주문 내역
- `status`: 주문 상태별 조회

**Review**:
- `reviewerId`: 작성자별 리뷰
- `reviewedId`: 받은 리뷰 조회

**ChatMessage**:
- `chatRoomId`: 채팅방 메시지 조회
- `senderId`: 발신자별 메시지

**Favorite**:
- `userId`: 사용자 찜 목록
- `productId`: 상품 찜 개수

**Notification**:
- `userId`: 사용자 알림 조회
- `isRead`: 읽지 않은 알림 조회

---

### 복합 인덱스

**Product**:
- `(status, createdAt)`: 판매중 상품 최신순 조회 (메인 페이지)
- `(categoryId, status)`: 카테고리 내 판매중 상품 (카테고리 페이지)
- `(latitude, longitude)`: 위치 기반 검색 (근처 상품)

**복합 인덱스 선정 기준**:
1. 자주 함께 사용되는 WHERE 조건
2. 조회 빈도가 높은 쿼리
3. 성능 개선 효과가 큰 경우

---

## 관계 설정

### Cascade 규칙

**ON DELETE CASCADE** (부모 삭제 시 자식도 삭제):
- `User → Product`: 사용자 삭제 시 상품도 삭제
- `Product → Favorite`: 상품 삭제 시 찜도 삭제
- `Order → Review`: 주문 삭제 시 리뷰도 삭제
- `ChatRoom → ChatRoomMember`: 채팅방 삭제 시 참여자 정보 삭제
- `ChatRoom → ChatMessage`: 채팅방 삭제 시 메시지 삭제
- `User → ChatRoomMember`: 사용자 삭제 시 채팅방 참여 정보 삭제
- `User → ChatMessage`: 사용자 삭제 시 메시지 삭제
- `User → Favorite`: 사용자 삭제 시 찜 정보 삭제
- `User → Notification`: 사용자 삭제 시 알림 삭제

**ON DELETE RESTRICT** (부모 삭제 제한, 자식 존재 시 삭제 불가):
- `Category → Product`: 카테고리에 상품이 있으면 삭제 불가
- `User → Order (buyer, seller)`: 주문이 있는 사용자는 삭제 불가
- `Product → Order`: 주문된 상품은 삭제 불가
- `User → Review (reviewer, reviewed)`: 리뷰가 있는 사용자는 삭제 불가

**ON DELETE SET NULL** (부모 삭제 시 자식의 FK를 NULL로 설정):
- `Category → Category (parent)`: 부모 카테고리 삭제 시 자식의 parentId를 NULL로

---

## 비즈니스 규칙

### User (사용자)

1. **인증**:
   - 이메일 또는 전화번호로 가입 가능
   - 이메일 인증 후 활성화
   - 비밀번호는 bcrypt로 해시화

2. **역할**:
   - 기본 역할은 USER
   - 역할 변경은 관리자만 가능

3. **평점**:
   - 리뷰 작성 시 자동 계산
   - rating = sum(reviews.rating) / ratingCount

---

### Category (카테고리)

1. **계층 구조**:
   - 최대 3단계까지 지원
   - 순환 참조 방지 로직 필요

2. **삭제**:
   - 하위 카테고리가 있으면 삭제 불가
   - 상품이 있으면 삭제 불가

---

### Product (상품)

1. **등록**:
   - 이미지는 최소 1장, 최대 10장
   - 위치 정보는 선택사항

2. **상태 변경**:
   - ACTIVE → RESERVED: 예약 기능 사용 시
   - RESERVED → SOLD: 결제 완료 시
   - ACTIVE → SOLD: 직거래 완료 시
   - 모든 상태 → DELETED: 삭제 시

3. **조회수**:
   - 상품 상세 조회 시 자동 증가
   - 동일 사용자 중복 카운트 방지 (세션 기반)

---

### Order (주문)

1. **생성**:
   - 주문번호는 자동 생성 (yyyyMMddHHmmss + random 6자리)
   - 상품 상태가 ACTIVE일 때만 주문 가능

2. **결제**:
   - 결제 완료 시 Product 상태를 SOLD로 변경
   - 결제 취소 시 Product 상태를 ACTIVE로 복원

3. **환불**:
   - PAID 상태에서만 환불 가능
   - 환불 완료 시 REFUNDED 상태로 변경

4. **구매 확정**:
   - DELIVERED 상태에서만 확정 가능
   - 확정 후 7일 이내 리뷰 작성 가능

---

### Review (리뷰)

1. **작성**:
   - 구매 확정 후 7일 이내 작성 가능
   - 하나의 주문에 하나의 리뷰만 작성 가능
   - 별점은 1~5 사이 정수

2. **대상**:
   - 구매자는 판매자에게 리뷰 작성
   - 판매자는 구매자에게 리뷰 작성

3. **평점 반영**:
   - 리뷰 작성 시 대상 사용자의 rating 재계산

---

### ChatRoom (채팅)

1. **생성**:
   - 상품 문의 시 자동 생성
   - 구매자와 판매자 간 1:1 채팅

2. **메시지**:
   - 텍스트, 이미지, 파일 전송 가능
   - 읽음 처리는 lastReadAt 업데이트

---

### Favorite (찜하기)

1. **추가/삭제**:
   - 토글 방식으로 동작
   - 중복 찜 방지 (복합 unique)

---

### Notification (알림)

1. **생성**:
   - 특정 이벤트 발생 시 자동 생성
   - 실시간 알림은 WebSocket 사용

2. **읽음 처리**:
   - isRead를 true로 변경
   - readAt에 현재 시간 저장

---

## 마이그레이션 히스토리

### 20251017155427_add_user_role_and_indexes

**변경사항**:
- User 모델에 Role enum 추가
- User 모델에 name 필드 추가
- User 모델에 인덱스 추가 (email, role, createdAt)
- 모든 도메인 모델 초기 생성

### 20251017155639_improve_category_and_product_indexes

**변경사항**:
- Category 모델에 계층 구조 지원 (parentId 추가)
- Category 인덱스 추가 (parentId, slug)
- Product 복합 인덱스 추가:
  - (status, createdAt): 판매중 상품 최신순
  - (categoryId, status): 카테고리 내 판매중 상품
  - (latitude, longitude): 위치 기반 검색
- Product 단일 인덱스 추가 (price)

---

## 성능 최적화 전략

### 1. 인덱스 활용

- **조회 빈도가 높은 컬럼**: 단일 인덱스 생성
- **함께 사용되는 WHERE 조건**: 복합 인덱스 생성
- **정렬 기준**: ORDER BY 절에 사용되는 컬럼 인덱싱

### 2. 쿼리 최적화

- **N+1 문제 방지**: Prisma include/select로 필요한 데이터만 조회
- **페이지네이션**: cursor 기반 페이지네이션 사용 권장
- **집계 쿼리**: 캐싱 활용 (Redis)

### 3. 데이터 정합성

- **Foreign Key 제약조건**: 데이터 무결성 보장
- **Unique 제약조건**: 중복 방지
- **NOT NULL 제약조건**: 필수 데이터 보장

### 4. 캐싱 전략

- **Redis 캐싱 대상**:
  - 상품 목록 (5분 TTL)
  - 카테고리 트리 (1시간 TTL)
  - 사용자 프로필 (10분 TTL)
  - 인기 검색어 (30분 TTL)

---

## 보안 고려사항

### 1. 개인정보 보호

- **비밀번호**: bcrypt 해시화 (salt rounds: 10)
- **민감 정보**: 암호화 저장 (전화번호, 주소)
- **로그**: 개인정보 마스킹 처리

### 2. 접근 제어

- **RBAC**: Role 기반 권한 관리
- **소유권 검증**: 본인 데이터만 수정/삭제 가능
- **Soft Delete**: isActive 플래그 활용

### 3. SQL Injection 방지

- **Prisma ORM**: 파라미터 바인딩 자동 처리
- **Raw Query**: 최소화, 필요 시 파라미터 바인딩 필수

---

## 향후 개선 사항

### Phase 3 계획

1. **전문 검색 (Full-text Search)**:
   - PostgreSQL Full-text Search 또는 Elasticsearch 도입
   - 상품 제목/설명 검색 성능 개선

2. **이미지 최적화**:
   - 썸네일 자동 생성
   - WebP 포맷 지원
   - CDN 연동

3. **알림 시스템 고도화**:
   - WebSocket 실시간 알림
   - 푸시 알림 (FCM)
   - 이메일 알림

4. **통계 데이터**:
   - 판매자 통계 (판매량, 매출)
   - 인기 카테고리 분석
   - 사용자 활동 로그

---

## 참고 자료

- [Prisma 공식 문서](https://www.prisma.io/docs)
- [PostgreSQL 인덱스 가이드](https://www.postgresql.org/docs/current/indexes.html)
- [데이터베이스 정규화](https://en.wikipedia.org/wiki/Database_normalization)
