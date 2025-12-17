# Swagger 응답 문서화 개선 가이드

## 📋 목차

1. [개요](#개요)
2. [현재 문제점](#현재-문제점)
3. [해결 방안](#해결-방안)
4. [단계별 구현 가이드](#단계별-구현-가이드)
5. [적용 예시](#적용-예시)
6. [검증 방법](#검증-방법)

---

## 개요

### 목적
- Interceptor 기반 응답 변환을 유지하면서 Swagger 문서를 정확하게 생성
- 응답 구조를 평탄화하여 `data.data` 중첩 제거
- 타입 안정성과 코드 재사용성 향상

### 핵심 원칙
- ✅ Service는 순수 비즈니스 로직만 처리 (HTTP 응답 포맷 무관)
- ✅ Interceptor가 응답을 자동으로 래핑
- ✅ Swagger 데코레이터로 문서화 정확성 보장

---

## 현재 문제점

### 1. 응답 구조 중첩
```json
// 현재 응답 (data가 2번 중첩)
{
  "success": true,
  "statusCode": 200,
  "data": {
    "data": [...],  // ❌ 중첩
    "meta": {...}
  },
  "timestamp": "..."
}
```

### 2. 타입 불일치
```typescript
// Controller 반환 타입
Promise<PaginatedResponseDto<Message>>  // success, statusCode 포함

// Service 실제 반환
{ data: [...], meta: {...} }  // success, statusCode 없음
// ❌ 타입 에러 발생
```

### 3. Swagger 문서 부정확
- 실제 응답 구조와 Swagger 문서가 불일치
- Interceptor가 추가하는 `success`, `statusCode`, `timestamp` 필드가 문서화되지 않음

---

## 해결 방안

### 아키텍처 개선

```
┌─────────────┐
│  Controller │  → 타입만 명시 (@ApiPaginatedResponse 데코레이터)
└──────┬──────┘
       ↓
┌──────────────┐
│   Service    │  → 순수 데이터만 반환 (PaginatedResult<T>)
└──────┬───────┘
       ↓
┌──────────────┐
│ Interceptor  │  → 자동 래핑 (success, statusCode, timestamp 추가 + 평탄화)
└──────┬───────┘
       ↓
   최종 응답 (items, meta)
```

### 최종 응답 구조

```json
{
  "success": true,
  "statusCode": 200,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "items": [...],      // ✅ 평탄화됨
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
}
```

---

## 단계별 구현 가이드

### Step 1: Interceptor 개선 (응답 평탄화)

**파일**: `src/common/interceptors/transform.interceptor.ts`

```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * 공통 응답 인터페이스
 */
export interface Response<T> {
  success: boolean;
  statusCode: number;
  message?: string;
  data?: T;
  items?: T[];  // 페이지네이션용
  meta?: any;   // 페이지네이션 메타데이터
  nextCursor?: string | number | null;  // 커서 페이지네이션용
  hasNextPage?: boolean;
  timestamp: string;
}

/**
 * 페이지네이션 결과 타입 가드
 */
function isPaginatedResult(data: any): data is { items: any[]; meta: any } {
  return (
    data &&
    typeof data === 'object' &&
    'items' in data &&
    'meta' in data &&
    Array.isArray(data.items)
  );
}

/**
 * 커서 페이지네이션 결과 타입 가드
 */
function isCursorPaginatedResult(
  data: any,
): data is { items: any[]; nextCursor: any; hasNextPage: boolean } {
  return (
    data &&
    typeof data === 'object' &&
    'items' in data &&
    'nextCursor' in data &&
    'hasNextPage' in data &&
    Array.isArray(data.items)
  );
}

/**
 * 응답 변환 인터셉터
 *
 * 역할:
 * 1. 모든 성공 응답에 success, statusCode, timestamp 추가
 * 2. 페이지네이션 응답 평탄화 (data.data → items)
 * 3. 커서 페이지네이션 응답 평탄화
 */
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
        const timestamp = new Date().toISOString();

        // 이미 변환된 응답인지 확인
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        // 오프셋 기반 페이지네이션 결과 평탄화
        if (isPaginatedResult(data)) {
          return {
            success: true,
            statusCode,
            items: data.items,  // ✅ items로 바로 노출
            meta: data.meta,
            timestamp,
          };
        }

        // 커서 기반 페이지네이션 결과 평탄화
        if (isCursorPaginatedResult(data)) {
          return {
            success: true,
            statusCode,
            items: data.items,
            nextCursor: data.nextCursor,
            hasNextPage: data.hasNextPage,
            timestamp,
          };
        }

        // 일반 데이터 응답
        return {
          success: true,
          statusCode,
          data,
          timestamp,
        };
      }),
    );
  }
}
```

**주요 변경점:**
1. ✅ `isPaginatedResult()` 타입 가드 추가
2. ✅ `isCursorPaginatedResult()` 타입 가드 추가
3. ✅ 페이지네이션 응답을 평탄화하여 `items`, `meta` 직접 노출
4. ✅ Response 인터페이스에 `items`, `meta` 필드 추가

---

### Step 2: Swagger 커스텀 데코레이터 생성

**파일**: `src/common/decorators/api-paginated-response.decorator.ts` (새 파일 생성)

```typescript
import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { PaginationMetaDto } from '../dto/response.dto';

/**
 * Swagger용 페이지네이션 응답 데코레이터
 *
 * Interceptor가 변환한 최종 응답 구조를 정확하게 문서화합니다.
 *
 * @param model - 응답 데이터 모델 클래스 (예: MessageDto, ProductDto)
 * @param description - 응답 설명 (선택)
 *
 * @example
 * ```typescript
 * @Get('/messages')
 * @ApiPaginatedResponse(MessageDto, '메시지 목록 조회 성공')
 * async getMessages() {
 *   return this.service.findMessages();
 * }
 * ```
 */
export const ApiPaginatedResponse = <TModel extends Type<any>>(
  model: TModel,
  description?: string,
) => {
  return applyDecorators(
    ApiExtraModels(model, PaginationMetaDto),
    ApiOkResponse({
      description: description || '페이지네이션된 데이터 조회 성공',
      schema: {
        allOf: [
          {
            properties: {
              success: {
                type: 'boolean',
                example: true,
                description: '성공 여부',
              },
              statusCode: {
                type: 'number',
                example: 200,
                description: 'HTTP 상태 코드',
              },
              timestamp: {
                type: 'string',
                example: '2024-01-01T00:00:00.000Z',
                description: '응답 시간',
              },
              items: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
                description: '데이터 배열',
              },
              meta: {
                $ref: getSchemaPath(PaginationMetaDto),
                description: '페이지네이션 메타데이터',
              },
            },
          },
        ],
      },
    }),
  );
};

/**
 * Swagger용 커서 페이지네이션 응답 데코레이터
 *
 * @param model - 응답 데이터 모델 클래스
 * @param description - 응답 설명 (선택)
 *
 * @example
 * ```typescript
 * @Get('/messages')
 * @ApiCursorPaginatedResponse(MessageDto, '메시지 목록 조회 성공')
 * async getMessages(@Query() query: CursorPaginationDto) {
 *   return this.service.findMessages(query);
 * }
 * ```
 */
export const ApiCursorPaginatedResponse = <TModel extends Type<any>>(
  model: TModel,
  description?: string,
) => {
  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      description: description || '커서 페이지네이션된 데이터 조회 성공',
      schema: {
        allOf: [
          {
            properties: {
              success: {
                type: 'boolean',
                example: true,
                description: '성공 여부',
              },
              statusCode: {
                type: 'number',
                example: 200,
                description: 'HTTP 상태 코드',
              },
              timestamp: {
                type: 'string',
                example: '2024-01-01T00:00:00.000Z',
                description: '응답 시간',
              },
              items: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
                description: '데이터 배열',
              },
              nextCursor: {
                type: 'string',
                nullable: true,
                example: '123',
                description: '다음 커서 (없으면 null)',
              },
              hasNextPage: {
                type: 'boolean',
                example: true,
                description: '다음 페이지 존재 여부',
              },
            },
          },
        ],
      },
    }),
  );
};

/**
 * Swagger용 단일 데이터 응답 데코레이터
 *
 * @param model - 응답 데이터 모델 클래스
 * @param description - 응답 설명 (선택)
 *
 * @example
 * ```typescript
 * @Get('/messages/:id')
 * @ApiDataResponse(MessageDto, '메시지 조회 성공')
 * async getMessage(@Param('id') id: string) {
 *   return this.service.findOne(id);
 * }
 * ```
 */
export const ApiDataResponse = <TModel extends Type<any>>(
  model: TModel,
  description?: string,
) => {
  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      description: description || '데이터 조회 성공',
      schema: {
        allOf: [
          {
            properties: {
              success: {
                type: 'boolean',
                example: true,
                description: '성공 여부',
              },
              statusCode: {
                type: 'number',
                example: 200,
                description: 'HTTP 상태 코드',
              },
              timestamp: {
                type: 'string',
                example: '2024-01-01T00:00:00.000Z',
                description: '응답 시간',
              },
              data: {
                $ref: getSchemaPath(model),
                description: '응답 데이터',
              },
            },
          },
        ],
      },
    }),
  );
};
```

**주요 기능:**
1. ✅ `@ApiPaginatedResponse` - 오프셋 기반 페이지네이션 문서화
2. ✅ `@ApiCursorPaginatedResponse` - 커서 기반 페이지네이션 문서화
3. ✅ `@ApiDataResponse` - 단일 데이터 응답 문서화
4. ✅ Interceptor 변환 후 최종 응답 구조를 정확하게 표현

---

### Step 3: Response DTO 정리

**파일**: `src/common/dto/response.dto.ts`

기존 `PaginatedResponseDto` 클래스는 제거하고, Swagger 문서화용 `PaginationMetaDto`만 유지합니다.

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMeta } from '../types';

/**
 * 페이지네이션 메타데이터 DTO (Swagger 문서화용)
 *
 * 실제로는 반환하지 않고, Swagger 스키마 생성에만 사용됩니다.
 */
export class PaginationMetaDto implements PaginationMeta {
  @ApiProperty({ description: '전체 항목 수', example: 100 })
  total: number;

  @ApiProperty({ description: '현재 페이지 번호', example: 1 })
  page: number;

  @ApiProperty({ description: '페이지당 항목 수', example: 10 })
  limit: number;

  @ApiProperty({ description: '전체 페이지 수', example: 10 })
  totalPages: number;

  @ApiProperty({ description: '다음 페이지 존재 여부', example: true })
  hasNextPage: boolean;

  @ApiProperty({ description: '이전 페이지 존재 여부', example: false })
  hasPreviousPage: boolean;

  @ApiPropertyOptional({
    description: '다음 페이지 번호',
    example: 2,
    nullable: true,
  })
  nextPage: number | null;

  @ApiPropertyOptional({
    description: '이전 페이지 번호',
    example: null,
    nullable: true,
  })
  previousPage: number | null;
}

// ❌ 제거: PaginatedResponseDto 클래스
// Service는 PaginatedResult<T> 인터페이스를 반환하고
// Interceptor가 자동으로 래핑하므로 불필요
```

**주요 변경점:**
1. ❌ `PaginatedResponseDto` 클래스 제거
2. ✅ `PaginationMetaDto`만 Swagger 스키마 생성용으로 유지
3. ✅ 실제 반환 타입은 `PaginatedResult<T>` 인터페이스 사용

---

### Step 4: PaginationUtil 수정

**파일**: `src/common/utils/pagination.util.ts`

`paginate()` 메서드의 반환 구조를 `items` 필드로 변경합니다.

```typescript
// 기존 코드에서 이 부분만 수정
static paginate<T>(
  data: T[],
  total: number,
  options: Required<Pick<PaginationOptions, 'page' | 'limit'>>,
): PaginatedResult<T> {
  const { page, limit } = options;
  const totalPages = Math.ceil(total / limit);

  return {
    items: data,  // ✅ data → items로 변경
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      nextPage: page < totalPages ? page + 1 : null,
      previousPage: page > 1 ? page - 1 : null,
    },
  };
}
```

---

### Step 5: Controller 적용

**파일**: 예) `src/modules/messages-mongo/messages-mongo.controller.ts`

기존 `@ApiOkResponse` 대신 커스텀 데코레이터 사용:

```typescript
import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiPaginatedResponse } from '@/common/decorators/api-paginated-response.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { PaginatedResult } from '@/common/types';
import { Message } from './schemas/message.schema';

@ApiTags('Messages (MongoDB)')
@Controller('messages-mongo')
export class MessagesMongoController {
  constructor(private readonly service: MessagesMongoService) {}

  @Get('/chatroom/:roomId/messages')
  @ApiOperation({ summary: '대화 메시지 조회' })
  @ApiParam({
    name: 'roomId',
    description: '대화방 아이디',
    example: '323e4567-e89b-12d3-a456-426614174000',
  })
  @ApiPaginatedResponse(MessageResponseDto, '대화방 메시지 목록 조회 성공')
  async getMessagesByRoomId(
    @Param('roomId') roomId: string,
    @Query() queryDto: PaginationDto,
  ): Promise<PaginatedResult<Message>> {
    // ✅ Service는 PaginatedResult<T>만 반환
    // ✅ Interceptor가 자동으로 success, statusCode, timestamp 추가
    return this.service.findMessagesByRoomId(roomId, queryDto);
  }
}
```

**주요 변경점:**
1. ✅ `@ApiPaginatedResponse` 데코레이터 사용
2. ✅ 반환 타입: `Promise<PaginatedResult<Message>>`
3. ✅ Service는 순수 데이터만 반환, Interceptor가 래핑 처리

---

### Step 6: Service 코드 (변경 없음)

**파일**: 예) `src/modules/messages-mongo/messages-mongo.service.ts`

Service는 그대로 유지됩니다. 순수 비즈니스 로직만 처리합니다.

```typescript
import { Injectable } from '@nestjs/common';
import { PaginationOptions, PaginatedResult } from '@/common/types';
import { PaginationUtil } from '@/common/utils';
import { Message } from './schemas/message.schema';

@Injectable()
export class MessagesMongoService {
  constructor(
    private readonly repository: MessagesRepositoryMongo,
  ) {}

  async findMessagesByRoomId(
    roomId: string,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<Message>> {
    // 기본값 정규화
    const normalized = PaginationUtil.normalize(pagination);

    // Repository에서 데이터 조회
    const { items, total } = await this.repository.findMessagesByRoomId(
      roomId,
      normalized,
    );

    // 페이지네이션 결과 반환 (순수 데이터만)
    return PaginationUtil.paginate(items, total, normalized);
  }
}
```

**코드 변경 없음:**
- ✅ Service는 HTTP 응답 포맷을 알 필요 없음
- ✅ `PaginatedResult<T>` 인터페이스만 반환
- ✅ Interceptor가 자동으로 래핑 처리

---

## 적용 예시

### 예시 1: 메시지 목록 조회

**Before (기존 코드):**
```typescript
@Get('/chatroom/:roomId/messages')
@ApiOkResponse({ type: PaginatedResponseDto })  // ❌ 부정확
async getMessagesByRoomId(
  @Param('roomId') roomId: string,
  @Query() queryDto: PaginationDto,
): Promise<PaginatedResponseDto<Message>> {  // ❌ 타입 불일치
  return this.service.findMessagesByRoomId(roomId, queryDto);
}
```

**After (개선 코드):**
```typescript
@Get('/chatroom/:roomId/messages')
@ApiPaginatedResponse(MessageResponseDto, '메시지 목록 조회 성공')  // ✅ 정확한 문서화
async getMessagesByRoomId(
  @Param('roomId') roomId: string,
  @Query() queryDto: PaginationDto,
): Promise<PaginatedResult<Message>> {  // ✅ 타입 일치
  return this.service.findMessagesByRoomId(roomId, queryDto);
}
```

**최종 응답:**
```json
{
  "success": true,
  "statusCode": 200,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "items": [
    {
      "id": "msg123",
      "content": "Hello",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
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
}
```

---

### 예시 2: 상품 목록 조회

**Controller:**
```typescript
import { ApiPaginatedResponse } from '@/common/decorators/api-paginated-response.decorator';

@Get()
@ApiOperation({ summary: '상품 목록 조회' })
@ApiPaginatedResponse(ProductResponseDto, '상품 목록 조회 성공')
async getProducts(
  @Query() queryDto: PaginationDto,
): Promise<PaginatedResult<Product>> {
  return this.service.findAll(queryDto);
}
```

**Service:**
```typescript
async findAll(
  pagination: PaginationOptions,
): Promise<PaginatedResult<Product>> {
  const normalized = PaginationUtil.normalize(pagination);
  const { items, total } = await this.repository.findAll(normalized);
  return PaginationUtil.paginate(items, total, normalized);
}
```

---

### 예시 3: 커서 기반 페이지네이션

**Controller:**
```typescript
import { ApiCursorPaginatedResponse } from '@/common/decorators/api-paginated-response.decorator';

@Get('/feed')
@ApiOperation({ summary: '피드 조회 (무한 스크롤)' })
@ApiCursorPaginatedResponse(PostResponseDto, '피드 조회 성공')
async getFeed(
  @Query() queryDto: CursorPaginationDto,
): Promise<CursorPaginatedResult<Post>> {
  return this.service.getFeed(queryDto);
}
```

**최종 응답:**
```json
{
  "success": true,
  "statusCode": 200,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "items": [...],
  "nextCursor": "eyJpZCI6MTIzfQ==",
  "hasNextPage": true
}
```

---

## 검증 방법

### 1. 타입 검증

```bash
# TypeScript 컴파일 에러 확인
npm run build

# 예상 결과: 에러 없이 컴파일 성공
```

### 2. Swagger UI 확인

```bash
# 서버 실행
npm run start:dev

# 브라우저에서 확인
http://localhost:3000/api
```

**확인 사항:**
- ✅ Responses 섹션에 정확한 응답 구조 표시
- ✅ `success`, `statusCode`, `timestamp`, `items`, `meta` 모든 필드 포함
- ✅ Example Value가 올바른 형식으로 표시

### 3. 실제 API 호출 테스트

```bash
# cURL로 테스트
curl -X GET "http://localhost:3000/messages-mongo/chatroom/test-room-123/messages?page=1&limit=10"
```

**예상 응답:**
```json
{
  "success": true,
  "statusCode": 200,
  "timestamp": "2024-01-01T00:00:00.000Z",
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
}
```

### 4. E2E 테스트

```typescript
// test/messages.e2e-spec.ts
describe('GET /messages-mongo/chatroom/:roomId/messages', () => {
  it('페이지네이션된 메시지 목록을 반환해야 함', async () => {
    const response = await request(app.getHttpServer())
      .get('/messages-mongo/chatroom/test-room/messages')
      .query({ page: 1, limit: 10 })
      .expect(200);

    // 응답 구조 검증
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('statusCode', 200);
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('items');
    expect(response.body).toHaveProperty('meta');

    // items 배열 검증
    expect(Array.isArray(response.body.items)).toBe(true);

    // meta 필드 검증
    const { meta } = response.body;
    expect(meta).toHaveProperty('total');
    expect(meta).toHaveProperty('page', 1);
    expect(meta).toHaveProperty('limit', 10);
    expect(meta).toHaveProperty('totalPages');
    expect(meta).toHaveProperty('hasNextPage');
    expect(meta).toHaveProperty('hasPreviousPage');
  });
});
```

---

## 체크리스트

적용 완료 후 다음 항목들을 확인하세요:

### 코드 수정
- [ ] `transform.interceptor.ts` 개선 (타입 가드, 평탄화 로직)
- [ ] `api-paginated-response.decorator.ts` 생성 (커스텀 데코레이터)
- [ ] `response.dto.ts` 정리 (`PaginatedResponseDto` 제거)
- [ ] `pagination.util.ts` 수정 (`data` → `items`)
- [ ] Controller에 `@ApiPaginatedResponse` 데코레이터 적용
- [ ] Controller 반환 타입을 `PaginatedResult<T>`로 변경

### 검증
- [ ] TypeScript 컴파일 에러 없음
- [ ] Swagger UI에서 응답 구조 정확히 표시됨
- [ ] 실제 API 호출 시 올바른 응답 구조 반환
- [ ] E2E 테스트 통과

### 문서화
- [ ] 팀원에게 변경 사항 공유
- [ ] API 문서 업데이트 (필요시)

---

## 추가 참고 자료

### NestJS 공식 문서
- [Interceptors](https://docs.nestjs.com/interceptors)
- [OpenAPI (Swagger)](https://docs.nestjs.com/openapi/introduction)
- [Custom decorators](https://docs.nestjs.com/openapi/decorators)

### 관련 파일
- `src/common/types/pagination.types.ts` - 타입 정의
- `src/common/dto/pagination.dto.ts` - 요청 DTO
- `src/common/utils/pagination.util.ts` - 유틸리티 함수

---

## 트러블슈팅

### 문제 1: "Property 'items' does not exist on type..."

**원인**: `PaginationUtil.paginate()`가 여전히 `data` 필드를 반환함

**해결**:
```typescript
// pagination.util.ts
return {
  items: data,  // ✅ data → items로 변경
  meta: { ... }
};
```

### 문제 2: Swagger에서 응답 구조가 표시되지 않음

**원인**: `@ApiExtraModels` 누락

**해결**:
```typescript
@ApiExtraModels(MessageDto, PaginationMetaDto)  // ✅ 추가
@ApiOkResponse({ ... })
```

### 문제 3: 타입 에러 - "Type 'PaginatedResult<T>' is not assignable..."

**원인**: Controller 반환 타입이 여전히 `PaginatedResponseDto<T>`

**해결**:
```typescript
async getMessages(): Promise<PaginatedResult<Message>> {  // ✅ 변경
  return this.service.findMessages();
}
```

---

## 결론

이 가이드를 따라 적용하면:

1. ✅ **관심사 분리**: Service는 비즈니스 로직만, Interceptor는 응답 포맷만 처리
2. ✅ **코드 중복 제거**: `success`, `statusCode`, `timestamp`를 매번 설정할 필요 없음
3. ✅ **타입 안정성**: Controller와 Service 간 타입 일치
4. ✅ **정확한 문서화**: Swagger가 실제 응답 구조를 정확히 표시
5. ✅ **깔끔한 응답 구조**: `data.data` 중첩 제거, `items`와 `meta`로 평탄화

질문이나 문제가 있으면 팀 채널에 공유해주세요! 🚀
