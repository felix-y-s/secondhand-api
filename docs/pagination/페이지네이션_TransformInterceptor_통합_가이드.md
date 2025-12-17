# 페이지네이션 TransformInterceptor 통합 가이드

## 개요

본 프로젝트는 `TransformInterceptor`를 사용하여 모든 API 응답을 일관된 형식으로 자동 변환합니다. 페이지네이션 응답도 이 인터셉터를 통해 처리되며, **일관된 `data` 구조**를 유지합니다.

---

## 핵심 설계 원칙

### 1. **일관된 응답 구조**

모든 API 응답은 `data` 필드 안에 실제 데이터를 포함합니다.

```json
// 일반 응답
{
  "success": true,
  "statusCode": 200,
  "data": { "id": 1, "name": "상품명" },
  "timestamp": "2024-01-01T00:00:00Z"
}

// 페이지네이션 응답
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [...],
    "meta": {
      "total": 100,
      "page": 1,
      "limit": 10,
      "totalPages": 10,
      "hasNextPage": true,
      "hasPreviousPage": false,
      "nextPage": 2,
      "previousPage": null
    }
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### 2. **자동 응답 래핑**

- Controller는 **순수 데이터만 반환**
- `TransformInterceptor`가 자동으로 표준 응답 형식으로 변환
- `ResponseDto` 클래스 불필요 (제거됨)

### 3. **계층별 역할**

```
Repository: DB 조회 → { items, meta }
     ↓
Service: 비즈니스 로직 → { items, meta }
     ↓
Controller: API 엔드포인트 → { items, meta }
     ↓
TransformInterceptor: 자동 래핑 → { success, statusCode, data: { items, meta }, timestamp }
     ↓
Client: 표준 응답 수신
```

---

## TransformInterceptor 구현

### 응답 변환 로직

```typescript
// src/common/interceptors/transform.interceptor.ts

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => {
        const response = context.switchToHttp().getResponse();
        const statusCode = response.statusCode;

        // 이미 변환된 응답인지 확인
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        // ✅ 페이지네이션 응답 처리
        if (
          data &&
          typeof data === 'object' &&
          'items' in data &&
          'meta' in data
        ) {
          return {
            success: true,
            statusCode,
            data: {
              items: data.items,
              meta: data.meta,
            },
            timestamp: new Date().toISOString(),
          };
        }

        // 일반 응답 처리
        return {
          success: true,
          statusCode,
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
```

### 응답 인터페이스

```typescript
// src/common/interceptors/transform.interceptor.ts

/**
 * 공통 응답 인터페이스
 */
export interface Response<T> {
  success: boolean;
  statusCode: number;
  message?: string;
  data?: T;
  timestamp: string;
}

/**
 * 페이지네이션 메타데이터
 */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextPage: number | null;
  previousPage: number | null;
}

/**
 * 페이지네이션 결과
 */
export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}
```

---

## PaginationUtil 사용법

### 메서드 개요

| 메서드 | 목적 | 반환 타입 |
|--------|------|-----------|
| `createMeta()` | 메타데이터만 생성 | `PaginationMeta` |
| `paginate()` | items + meta 생성 | `PaginatedResult<T>` |
| `getPrismaOptions()` | Prisma 쿼리 옵션 | `{ skip, take, orderBy }` |
| `getMongoOptions()` | MongoDB 쿼리 옵션 | `{ skip, limit, sort }` |
| `normalize()` | Optional → Required 변환 | `Required<PaginationOptions>` |

### createMeta() - 메타데이터만 생성

```typescript
/**
 * 페이지네이션 메타데이터만 생성
 */
static createMeta(
  total: number,
  options: Required<Pick<PaginationOptions, 'page' | 'limit'>>,
): PaginationMeta {
  const { page, limit } = options;
  const totalPages = Math.ceil(total / limit);

  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
    nextPage: page < totalPages ? page + 1 : null,
    previousPage: page > 1 ? page - 1 : null,
  };
}
```

### paginate() - 전체 결과 생성

```typescript
/**
 * 페이지네이션 결과 생성 (items + meta)
 */
static paginate<T>(
  items: T[],
  total: number,
  options: Required<Pick<PaginationOptions, 'page' | 'limit'>>,
): PaginatedResult<T> {
  return {
    items,
    meta: this.createMeta(total, options),
  };
}
```

---

## 계층별 구현 패턴

### 1. Repository 계층

```typescript
export class ProductsRepository {
  async findAll(
    options: Required<PaginationOptions>
  ): Promise<PaginatedResult<Product>> {
    // Prisma 예시
    const prismaOptions = PaginationUtil.getPrismaOptions(options);

    const [items, total] = await Promise.all([
      this.prisma.product.findMany(prismaOptions),
      this.prisma.product.count(),
    ]);

    // ✅ { items, meta } 반환
    return PaginationUtil.paginate(items, total, options);
  }
}
```

```typescript
export class MessagesMongoRepository {
  async findAll(
    options: Required<PaginationOptions>
  ): Promise<PaginatedResult<Message>> {
    // MongoDB 예시
    const mongoOptions = PaginationUtil.getMongoOptions(options);

    const [items, total] = await Promise.all([
      this.messageModel
        .find()
        .skip(mongoOptions.skip)
        .limit(mongoOptions.limit)
        .sort(mongoOptions.sort || {})
        .exec(),
      this.messageModel.countDocuments(),
    ]);

    // ✅ { items, meta } 반환
    return PaginationUtil.paginate(items, total, options);
  }
}
```

---

### 2. Service 계층

```typescript
@Injectable()
export class ProductsService {
  async findAll(
    pagination: PaginationOptions
  ): Promise<PaginatedResult<Product>> {
    // Optional → Required 변환
    const normalized = PaginationUtil.normalize(pagination);

    // Repository에서 { items, meta } 반환
    return this.repository.findAll(normalized);
  }
}
```

---

### 3. Controller 계층

```typescript
@Controller('products')****
export class ProductsController {
  @Get()
  @ApiOkResponse({
    description: '상품 목록 조회 성공',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        statusCode: { type: 'number', example: 200 },
        data: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { $ref: '#/components/schemas/Product' } },
            meta: {
              type: 'object',
              properties: {
                total: { type: 'number', example: 100 },
                page: { type: 'number', example: 1 },
                limit: { type: 'number', example: 10 },
                totalPages: { type: 'number', example: 10 },
                hasNextPage: { type: 'boolean', example: true },
                hasPreviousPage: { type: 'boolean', example: false },
                nextPage: { type: 'number', example: 2 },
                previousPage: { type: 'number', example: null }
              }
            }
          }
        },
        timestamp: { type: 'string', example: '2024-01-01T00:00:00Z' }
      }
    }
  })
  async findAll(
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResult<Product>> {
    // ✅ Service에서 { items, meta } 반환
    // ✅ TransformInterceptor가 자동으로 래핑
    return this.service.findAll(pagination);
  }

  @Get(':id')
  @ApiOkResponse({
    description: '상품 조회 성공',
    type: Product
  })
  async findOne(@Param('id') id: string): Promise<Product> {
    // ✅ 일반 객체 반환
    // ✅ TransformInterceptor가 자동으로 래핑
    return this.service.findOne(id);
  }
}
```

---

## 응답 흐름도

```
┌─────────────────────────────────────────────────┐
│            Repository 계층                       │
│  PaginationUtil.paginate(items, total, options) │
│                                                  │
│  return {                                        │
│    items: [...],                                 │
│    meta: { total, page, limit, ... }            │
│  }                                               │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│              Service 계층                        │
│  비즈니스 로직 처리                               │
│                                                  │
│  return {                                        │
│    items: [...],                                 │
│    meta: { total, page, limit, ... }            │
│  }                                               │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│            Controller 계층                       │
│  API 엔드포인트                                  │
│                                                  │
│  return {                                        │
│    items: [...],                                 │
│    meta: { total, page, limit, ... }            │
│  }                                               │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│        TransformInterceptor                     │
│  자동 응답 래핑 (items, meta 감지)               │
│                                                  │
│  return {                                        │
│    success: true,                                │
│    statusCode: 200,                              │
│    data: {                                       │
│      items: [...],                               │
│      meta: { total, page, limit, ... }          │
│    },                                            │
│    timestamp: "2024-01-01T00:00:00Z"            │
│  }                                               │
└─────────────────────────────────────────────────┘
                    ↓
                 Client
```

---

## 실전 예제

### 예제 1: 상품 목록 조회 (Prisma)

```typescript
// 1. Repository
export class ProductsRepository {
  async findAll(options: Required<PaginationOptions>) {
    const prismaOptions = PaginationUtil.getPrismaOptions(options);

    const [items, total] = await Promise.all([
      this.prisma.product.findMany(prismaOptions),
      this.prisma.product.count(),
    ]);

    return PaginationUtil.paginate(items, total, options);
  }
}

// 2. Service
export class ProductsService {
  async findAll(pagination: PaginationOptions) {
    const normalized = PaginationUtil.normalize(pagination);
    return this.repository.findAll(normalized);
  }
}

// 3. Controller
@Get()
async findAll(@Query() pagination: PaginationDto) {
  return this.service.findAll(pagination);
}
```

**요청**:
```http
GET /api/v1/products?page=2&limit=20&sortBy=price&sortOrder=DESC
```

**응답**:
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [
      { "id": 1, "name": "상품1", "price": 50000 },
      { "id": 2, "name": "상품2", "price": 45000 }
    ],
    "meta": {
      "total": 100,
      "page": 2,
      "limit": 20,
      "totalPages": 5,
      "hasNextPage": true,
      "hasPreviousPage": true,
      "nextPage": 3,
      "previousPage": 1
    }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

---

### 예제 2: 메시지 목록 조회 (MongoDB)

```typescript
// 1. Repository
export class MessagesMongoRepository {
  async findByRoomId(
    roomId: string,
    options: Required<PaginationOptions>
  ) {
    const mongoOptions = PaginationUtil.getMongoOptions(options);

    const [items, total] = await Promise.all([
      this.messageModel
        .find({ roomId })
        .skip(mongoOptions.skip)
        .limit(mongoOptions.limit)
        .sort(mongoOptions.sort || {})
        .exec(),
      this.messageModel.countDocuments({ roomId }),
    ]);

    return PaginationUtil.paginate(items, total, options);
  }
}

// 2. Service
export class MessagesService {
  async findByRoomId(roomId: string, pagination: PaginationOptions) {
    const normalized = PaginationUtil.normalize(pagination);
    return this.repository.findByRoomId(roomId, normalized);
  }
}

// 3. Controller
@Get(':roomId')
async getMessages(
  @Param('roomId') roomId: string,
  @Query() pagination: PaginationDto,
) {
  return this.service.findByRoomId(roomId, pagination);
}
```

**요청**:
```http
GET /api/v1/messages/room-123?page=1&limit=50
```

**응답**:
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [
      { "id": "msg1", "content": "안녕하세요", "createdAt": "..." },
      { "id": "msg2", "content": "반갑습니다", "createdAt": "..." }
    ],
    "meta": {
      "total": 150,
      "page": 1,
      "limit": 50,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPreviousPage": false,
      "nextPage": 2,
      "previousPage": null
    }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

---

## 베스트 프랙티스

### ✅ DO (권장사항)

#### 1. Controller는 순수 데이터만 반환
```typescript
// ✅ 올바른 패턴
@Get()
async findAll(@Query() pagination: PaginationDto) {
  return this.service.findAll(pagination);  // { items, meta }
}

// ❌ 잘못된 패턴 (수동 래핑 불필요)
@Get()
async findAll(@Query() pagination: PaginationDto) {
  const result = await this.service.findAll(pagination);
  return {
    success: true,
    data: result,
    timestamp: new Date().toISOString()
  };
}
```

#### 2. Repository는 PaginationUtil 사용
```typescript
// ✅ 올바른 패턴
return PaginationUtil.paginate(items, total, options);

// ❌ 잘못된 패턴 (수동 메타데이터 생성)
return {
  items,
  meta: {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page < Math.ceil(total / limit),
    // ...
  }
};
```

#### 3. Service는 normalize() 호출
```typescript
// ✅ 올바른 패턴
async findAll(pagination: PaginationOptions) {
  const normalized = PaginationUtil.normalize(pagination);
  return this.repository.findAll(normalized);
}

// ❌ 잘못된 패턴 (null 체크 중복)
async findAll(pagination: PaginationOptions) {
  const page = pagination.page ?? 1;
  const limit = pagination.limit ?? 10;
  return this.repository.findAll({ page, limit, ... });
}
```

---

### ❌ DON'T (안티패턴)

#### 1. ResponseDto 클래스 사용 금지
```typescript
// ❌ 불필요한 패턴 (삭제됨)
return ResponseDto.success(data, 'Success');
return PaginatedResponseDto.create(items, meta, 'Success');

// ✅ TransformInterceptor가 자동 처리
return data;
return { items, meta };
```

#### 2. Controller에서 수동 래핑 금지
```typescript
// ❌ 중복 래핑
return {
  success: true,
  data: result,
  timestamp: new Date().toISOString()
};

// ✅ 자동 래핑
return result;
```

---

## 마이그레이션 가이드

### 기존 코드에서 변경 사항

#### Before (기존 패턴)
```typescript
// Controller
@Get()
async findAll(@Query() pagination: PaginationDto) {
  const result = await this.service.findAll(pagination);
  return PaginatedResponseDto.create(
    result.items,
    result.meta,
    '조회 성공'
  );
}
```

#### After (새로운 패턴)
```typescript
// Controller
@Get()
async findAll(@Query() pagination: PaginationDto) {
  // TransformInterceptor가 자동 래핑
  return this.service.findAll(pagination);
}
```

---

## 요약

### 핵심 포인트

1. **TransformInterceptor가 모든 응답을 자동 래핑**
   - Controller는 순수 데이터만 반환
   - `{ items, meta }` 구조 자동 감지

2. **일관된 응답 구조**
   - 모든 응답에서 `data` 필드 사용
   - 페이지네이션도 `data: { items, meta }` 구조

3. **PaginationUtil 활용**
   - `paginate()`: items + meta 생성
   - `createMeta()`: 메타데이터만 생성
   - `normalize()`: Optional → Required 변환

4. **ResponseDto 클래스 제거**
   - 수동 래핑 불필요
   - Interface만 타입 정의용으로 유지

### 체크리스트

- [ ] Controller는 `{ items, meta }` 반환
- [ ] Service는 `PaginationUtil.normalize()` 호출
- [ ] Repository는 `PaginationUtil.paginate()` 사용
- [ ] ResponseDto 클래스 사용 제거
- [ ] TransformInterceptor가 전역 등록되어 있는지 확인

### 참고 파일

- `src/common/interceptors/transform.interceptor.ts` - 응답 변환 로직
- `src/common/utils/pagination.util.ts` - 페이지네이션 유틸리티
- `src/common/types/pagination.types.ts` - 타입 정의
- `src/main.ts` - TransformInterceptor 전역 등록
