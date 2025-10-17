# Swagger API 문서화 가이드

## 개요

Swagger (OpenAPI 3.0)를 사용하여 RESTful API를 자동으로 문서화합니다. 모든 엔드포인트는 표준화된 방식으로 문서화되어야 합니다.

## Swagger UI 접속

**개발 환경**: http://localhost:3000/api-docs

Swagger UI에서 다음 작업을 수행할 수 있습니다:
- API 엔드포인트 탐색 및 테스트
- 요청/응답 스키마 확인
- JWT 토큰을 사용한 인증 테스트

## 컨트롤러 문서화

### 기본 컨트롤러 설정

```typescript
import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ApiGetResponses, ApiCreateResponses } from '@/common/decorators';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  @ApiOperation({
    summary: '사용자 목록 조회',
    description: '페이지네이션을 지원하는 사용자 목록 조회 API'
  })
  @ApiGetResponses(PaginatedResponseDto)
  @Get()
  async findAll(@Query() query: PaginationDto) {
    return this.usersService.findAll(query);
  }

  @ApiOperation({
    summary: '사용자 생성',
    description: '새로운 사용자를 생성합니다'
  })
  @ApiCreateResponses(UserResponseDto)
  @Post()
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }
}
```

**주요 데코레이터**:
- `@ApiTags()`: API 그룹화 (users, products, orders 등)
- `@ApiBearerAuth()`: JWT 인증 필요 표시
- `@ApiOperation()`: 엔드포인트 설명 (summary, description)
- `@ApiGetResponses()`, `@ApiCreateResponses()`: 표준 응답 자동 추가

## DTO 문서화

### 요청 DTO

```typescript
import { IsString, IsEmail, MinLength, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    description: '사용자 이메일',
    example: 'user@example.com',
    format: 'email',
  })
  @IsEmail({}, { message: '유효한 이메일 형식이 아닙니다' })
  email: string;

  @ApiProperty({
    description: '사용자 비밀번호',
    example: 'password123!',
    minLength: 8,
    maxLength: 20,
    format: 'password',
  })
  @IsString()
  @MinLength(8, { message: '비밀번호는 최소 8자 이상이어야 합니다' })
  @MaxLength(20, { message: '비밀번호는 최대 20자 이하여야 합니다' })
  password: string;

  @ApiPropertyOptional({
    description: '사용자 이름',
    example: '홍길동',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;
}
```

**주요 속성**:
- `description`: 필드 설명
- `example`: 예시 값
- `format`: 데이터 형식 (email, password, date-time 등)
- `minLength`, `maxLength`: 길이 제한
- `minimum`, `maximum`: 숫자 범위
- `nullable`: null 허용 여부
- `required`: 필수 여부 (기본값: true)

### 응답 DTO

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({
    description: '사용자 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: '사용자 이메일',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: '사용자 이름',
    example: '홍길동',
    nullable: true,
  })
  name: string | null;

  @ApiProperty({
    description: '생성 일시',
    example: '2025-10-17T10:30:00Z',
    format: 'date-time',
  })
  createdAt: Date;
}
```

## 표준 응답 데코레이터

### 자동 응답 추가

표준 응답 데코레이터를 사용하면 공통 에러 응답이 자동으로 추가됩니다.

```typescript
import {
  ApiGetResponses,
  ApiCreateResponses,
  ApiUpdateResponses,
  ApiDeleteResponses,
  ApiPublicResponses
} from '@/common/decorators';

// GET 요청 (200 OK)
@ApiGetResponses(UserResponseDto, '사용자 정보 조회 성공')
@Get(':id')
async findOne(@Param('id') id: string) {
  return this.usersService.findOne(id);
}

// POST 요청 (201 Created)
@ApiCreateResponses(UserResponseDto, '사용자 생성 성공')
@Post()
async create(@Body() dto: CreateUserDto) {
  return this.usersService.create(dto);
}

// PATCH 요청 (200 OK)
@ApiUpdateResponses(UserResponseDto, '사용자 수정 성공')
@Patch(':id')
async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
  return this.usersService.update(id, dto);
}

// DELETE 요청 (204 No Content)
@ApiDeleteResponses('사용자 삭제 성공')
@Delete(':id')
async remove(@Param('id') id: string) {
  return this.usersService.remove(id);
}

// 인증 불필요 API (401, 403 에러 제외)
@ApiPublicResponses(200, UserResponseDto, '공개 프로필 조회 성공')
@Public()
@Get('public/:id')
async publicProfile(@Param('id') id: string) {
  return this.usersService.getPublicProfile(id);
}
```

**자동으로 추가되는 응답**:
- `400 Bad Request`: Validation 에러
- `401 Unauthorized`: 인증 실패
- `403 Forbidden`: 권한 부족
- `429 Too Many Requests`: Rate Limit 초과
- `500 Internal Server Error`: 서버 에러

## 인증 문서화

### JWT Bearer 인증

```typescript
import { ApiBearerAuth } from '@nestjs/swagger';

// 컨트롤러 전체에 적용
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {}

// 특정 엔드포인트에만 적용
@ApiBearerAuth('access-token')
@Get('profile')
async getProfile(@CurrentUser() user: JwtValidationResult) {
  return this.usersService.getProfile(user.userId);
}

// Refresh Token 사용
@ApiBearerAuth('refresh-token')
@Post('auth/refresh')
async refresh(@CurrentUser() user: JwtValidationResult) {
  return this.authService.refresh(user.userId);
}
```

### 공개 API 문서화

```typescript
import { Public } from '@/common/auth';
import { ApiPublicResponses } from '@/common/decorators';

@Public()
@ApiPublicResponses(200, LoginResponseDto, '로그인 성공')
@Post('auth/login')
async login(@Body() dto: LoginDto) {
  return this.authService.login(dto);
}
```

## Rate Limiting 문서화

### Rate Limit 정보 추가

```typescript
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { ApiOperation } from '@nestjs/swagger';

// Short 제한 (1분당 10회)
@ApiOperation({
  summary: '로그인',
  description: '사용자 로그인\n\n**Rate Limit**: 1분당 10회',
})
@Throttle({ short: { ttl: 60000, limit: 10 } })
@Post('auth/login')
async login(@Body() dto: LoginDto) {
  return this.authService.login(dto);
}

// Medium 제한 (1분당 30회)
@ApiOperation({
  summary: '상품 생성',
  description: '새로운 상품을 생성합니다\n\n**Rate Limit**: 1분당 30회',
})
@Throttle({ medium: { ttl: 60000, limit: 30 } })
@Post('products')
async createProduct(@Body() dto: CreateProductDto) {
  return this.productsService.create(dto);
}

// Long 제한 (1분당 100회)
@ApiOperation({
  summary: '상품 목록 조회',
  description: '페이지네이션을 지원하는 상품 목록 조회\n\n**Rate Limit**: 1분당 100회',
})
@Throttle({ long: { ttl: 60000, limit: 100 } })
@Get('products')
async getProducts(@Query() query: PaginationDto) {
  return this.productsService.findAll(query);
}

// Rate Limiting 제외
@ApiOperation({
  summary: '헬스체크',
  description: '서버 상태 확인 (Rate Limiting 제외)',
})
@SkipThrottle()
@Get('health')
async healthCheck() {
  return { status: 'ok' };
}
```

## 쿼리 파라미터 문서화

### 페이지네이션

```typescript
import { ApiQuery } from '@nestjs/swagger';
import { PaginationDto } from '@/common/dto';

@ApiQuery({ name: 'page', required: false, type: Number, description: '페이지 번호 (1부터 시작)', example: 1 })
@ApiQuery({ name: 'limit', required: false, type: Number, description: '페이지당 항목 수', example: 10 })
@ApiQuery({ name: 'sortBy', required: false, type: String, description: '정렬 기준 필드', example: 'createdAt' })
@ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'], description: '정렬 순서', example: 'DESC' })
@Get()
async findAll(@Query() query: PaginationDto) {
  return this.service.findAll(query);
}
```

### 검색

```typescript
import { SearchDto } from '@/common/dto';

@ApiQuery({ name: 'keyword', required: false, type: String, description: '검색 키워드', example: '노트북' })
@ApiQuery({ name: 'category', required: false, type: String, description: '카테고리 필터', example: '전자제품' })
@Get('search')
async search(@Query() query: SearchDto) {
  return this.service.search(query);
}
```

## 파일 업로드 문서화

```typescript
import { ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiConsumes('multipart/form-data')
@ApiBody({
  description: '상품 이미지 업로드',
  schema: {
    type: 'object',
    properties: {
      file: {
        type: 'string',
        format: 'binary',
        description: '업로드할 이미지 파일',
      },
    },
  },
})
@UseInterceptors(FileInterceptor('file'))
@Post('products/:id/image')
async uploadImage(
  @Param('id') id: string,
  @UploadedFile() file: Express.Multer.File,
) {
  return this.productsService.uploadImage(id, file);
}
```

## Enum 문서화

```typescript
export enum Role {
  ADMIN = 'admin',
  USER = 'user',
  SELLER = 'seller',
  BUYER = 'buyer',
}

export class UpdateUserDto {
  @ApiProperty({
    description: '사용자 역할',
    enum: Role,
    example: Role.USER,
  })
  @IsEnum(Role)
  role: Role;
}
```

## 배열 응답 문서화

```typescript
@ApiOperation({ summary: '사용자 목록 조회' })
@ApiResponse({
  status: 200,
  description: '사용자 목록 조회 성공',
  type: [UserResponseDto], // 배열 타입
})
@Get()
async findAll() {
  return this.usersService.findAll();
}
```

## 조건부 응답 문서화

```typescript
@ApiResponse({ status: 200, description: '상품 조회 성공', type: ProductResponseDto })
@ApiResponse({ status: 404, description: '상품을 찾을 수 없음', type: ErrorResponseDto })
@Get(':id')
async findOne(@Param('id') id: string) {
  return this.productsService.findOne(id);
}
```

## Swagger UI 설정

### JWT 토큰 인증 테스트

1. Swagger UI 접속: http://localhost:3000/api-docs
2. 우측 상단 `Authorize` 버튼 클릭
3. Access Token 입력 (Bearer 제외)
4. `Authorize` 버튼 클릭하여 인증 완료
5. 이제 인증이 필요한 API 테스트 가능

### 환경별 서버 선택

Swagger UI 상단에서 서버 선택 가능:
- 개발 서버: http://localhost:3000
- 스테이징 서버: https://staging.api.example.com
- 프로덕션 서버: https://api.example.com

## 모범 사례

### 1. 명확한 설명 작성

```typescript
// ❌ 나쁜 예
@ApiOperation({ summary: '조회' })
@Get(':id')
async findOne(@Param('id') id: string) {}

// ✅ 좋은 예
@ApiOperation({
  summary: '사용자 상세 정보 조회',
  description: 'ID를 기반으로 사용자의 상세 정보를 조회합니다. 인증이 필요합니다.'
})
@Get(':id')
async findOne(@Param('id') id: string) {}
```

### 2. 적절한 예시 값 제공

```typescript
// ❌ 나쁜 예
@ApiProperty({ description: '이메일' })
email: string;

// ✅ 좋은 예
@ApiProperty({
  description: '사용자 이메일',
  example: 'user@example.com',
  format: 'email'
})
email: string;
```

### 3. 에러 응답 문서화

```typescript
// ❌ 나쁜 예
@Post()
async create(@Body() dto: CreateUserDto) {}

// ✅ 좋은 예
@ApiCreateResponses(UserResponseDto, '사용자 생성 성공')
@ApiResponse({ status: 409, description: '이메일 중복' })
@Post()
async create(@Body() dto: CreateUserDto) {}
```

### 4. Rate Limiting 정보 포함

```typescript
@ApiOperation({
  summary: '로그인',
  description: '사용자 인증을 수행합니다\n\n' +
    '**Rate Limit**: 1분당 10회\n' +
    '**인증 방식**: 이메일 + 비밀번호'
})
```

## 참고 자료

- [NestJS Swagger 공식 문서](https://docs.nestjs.com/openapi/introduction)
- [OpenAPI 3.0 Specification](https://swagger.io/specification/)
- [Swagger UI 사용법](https://swagger.io/tools/swagger-ui/)
