# Phase 4 상세 개발 실행 계획서

**작성일**: 2025-10-24
**대상 기간**: Week 11-14 (4주)
**목표**: 확장 도메인 3개 구현 + 시스템 통합

---

## 📋 Phase 4 개요

### 목표
- **Reviews 모듈**: 거래 후 평가 시스템으로 신뢰도 향상
- **Messages 모듈**: 구매자-판매자 실시간 커뮤니케이션
- **Notifications 모듈**: 통합 알림 시스템 구축
- **시스템 통합**: 도메인 간 연동 검증 및 최적화

### 성공 지표
- ✅ 3개 도메인 모듈 완성
- ✅ 20-25개 API 엔드포인트 추가
- ✅ E2E 테스트 30-45개 추가 (총 90-107개)
- ✅ 전체 시스템 통합 테스트 통과
- ✅ 코드 리팩토링 완료

### 산출물
1. Reviews 모듈 (5-7개 API)
2. Messages 모듈 (6-8개 API)
3. Notifications 모듈 (4-6개 API)
4. 통합 테스트 스위트
5. 리팩토링된 코드베이스
6. 업데이트된 API 문서

---

## 📅 Week 11: Reviews 모듈 구현

### 📌 Day 1: 스키마 설계 및 DTO 작성

#### 오전: Prisma 스키마 설계
```prisma
// prisma/schema.prisma

model Review {
  id         String   @id @default(uuid())
  orderId    String
  reviewerId String   // 리뷰 작성자 (구매자 또는 판매자)
  revieweeId String   // 리뷰 대상자 (판매자 또는 구매자)
  rating     Int      @db.SmallInt // 1-5 별점
  comment    String?  @db.Text
  images     String[] // 리뷰 이미지 URL 배열

  // 메타데이터
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  // 관계
  order      Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  reviewer   User     @relation("ReviewsGiven", fields: [reviewerId], references: [id])
  reviewee   User     @relation("ReviewsReceived", fields: [revieweeId], references: [id])

  @@unique([orderId, reviewerId]) // 1주문당 1리뷰 제약
  @@index([revieweeId]) // 사용자별 리뷰 조회 최적화
  @@index([orderId])
  @@map("reviews")
}

// User 모델에 추가
model User {
  // 기존 필드들...

  reviewsGiven    Review[] @relation("ReviewsGiven")
  reviewsReceived Review[] @relation("ReviewsReceived")

  // 신뢰도 점수 (계산 필드 또는 별도 저장)
  trustScore      Float?   @default(0.0)
  reviewCount     Int      @default(0)
  averageRating   Float?   @default(0.0)
}
```

**작업 항목**:
- [ ] Prisma 스키마에 Review 모델 추가
- [ ] User 모델에 리뷰 관계 추가
- [ ] 마이그레이션 파일 생성 및 실행
- [ ] Prisma Client 재생성

**체크포인트**:
```bash
# 마이그레이션 실행
pnpx prisma migrate dev --name add_reviews

# Prisma Studio로 스키마 확인
pnpx prisma studio
```

#### 오후: DTO 작성

**파일 구조**:
```
src/modules/reviews/
├── dto/
│   ├── create-review.dto.ts
│   ├── update-review.dto.ts
│   ├── query-reviews.dto.ts
│   └── review-response.dto.ts
```

**1. CreateReviewDto**
```typescript
// src/modules/reviews/dto/create-review.dto.ts
import { IsString, IsInt, Min, Max, IsOptional, IsArray, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReviewDto {
  @ApiProperty({
    description: '주문 ID',
    example: 'order-uuid-123',
  })
  @IsString()
  orderId: string;

  @ApiProperty({
    description: '별점 (1-5)',
    minimum: 1,
    maximum: 5,
    example: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({
    description: '리뷰 내용',
    maxLength: 1000,
    example: '좋은 거래였습니다. 감사합니다!',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  @ApiPropertyOptional({
    description: '리뷰 이미지 URL 배열',
    type: [String],
    example: ['https://cdn.example.com/review1.jpg'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}
```

**2. UpdateReviewDto**
```typescript
// src/modules/reviews/dto/update-review.dto.ts
import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateReviewDto } from './create-review.dto';

export class UpdateReviewDto extends PartialType(
  OmitType(CreateReviewDto, ['orderId'] as const),
) {}
```

**3. QueryReviewsDto**
```typescript
// src/modules/reviews/dto/query-reviews.dto.ts
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryReviewsDto {
  @ApiPropertyOptional({
    description: '페이지 번호',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: '페이지당 항목 수',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: '리뷰 대상자 ID',
    example: 'user-uuid-123',
  })
  @IsOptional()
  @IsString()
  revieweeId?: string;

  @ApiPropertyOptional({
    description: '최소 별점',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  minRating?: number;
}
```

**4. ReviewResponseDto**
```typescript
// src/modules/reviews/dto/review-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class ReviewerInfoDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  nickname: string;

  @ApiPropertyOptional()
  profileImage?: string;
}

export class ReviewResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  orderId: string;

  @ApiProperty()
  rating: number;

  @ApiPropertyOptional()
  comment?: string;

  @ApiPropertyOptional({ type: [String] })
  images?: string[];

  @ApiProperty()
  reviewer: ReviewerInfoDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: Partial<ReviewResponseDto>) {
    Object.assign(this, partial);
  }
}
```

**작업 항목**:
- [ ] CreateReviewDto 작성 및 검증 규칙 적용
- [ ] UpdateReviewDto 작성
- [ ] QueryReviewsDto 작성 (페이지네이션 + 필터링)
- [ ] ReviewResponseDto 작성 (Swagger 문서화)

---

### 📌 Day 2: Repository 및 Service 구현

#### 오전: Repository 구현

```typescript
// src/modules/reviews/repositories/reviews.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateReviewDto } from '../dto/create-review.dto';
import { UpdateReviewDto } from '../dto/update-review.dto';
import { QueryReviewsDto } from '../dto/query-reviews.dto';

@Injectable()
export class ReviewsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 리뷰 생성
   */
  async create(reviewerId: string, dto: CreateReviewDto) {
    return this.prisma.review.create({
      data: {
        reviewerId,
        revieweeId: dto.revieweeId,
        orderId: dto.orderId,
        rating: dto.rating,
        comment: dto.comment,
        images: dto.images || [],
      },
      include: {
        reviewer: {
          select: {
            id: true,
            nickname: true,
            profileImage: true,
          },
        },
      },
    });
  }

  /**
   * 리뷰 목록 조회 (페이지네이션 + 필터링)
   */
  async findMany(query: QueryReviewsDto) {
    const { page = 1, limit = 20, revieweeId, minRating } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (revieweeId) where.revieweeId = revieweeId;
    if (minRating) where.rating = { gte: minRating };

    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        include: {
          reviewer: {
            select: {
              id: true,
              nickname: true,
              profileImage: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 리뷰 상세 조회
   */
  async findById(id: string) {
    return this.prisma.review.findUnique({
      where: { id },
      include: {
        reviewer: {
          select: {
            id: true,
            nickname: true,
            profileImage: true,
          },
        },
        order: {
          select: {
            id: true,
            product: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * 주문별 리뷰 조회
   */
  async findByOrderId(orderId: string) {
    return this.prisma.review.findFirst({
      where: { orderId },
      include: {
        reviewer: {
          select: {
            id: true,
            nickname: true,
            profileImage: true,
          },
        },
      },
    });
  }

  /**
   * 리뷰 수정
   */
  async update(id: string, dto: UpdateReviewDto) {
    return this.prisma.review.update({
      where: { id },
      data: dto,
      include: {
        reviewer: {
          select: {
            id: true,
            nickname: true,
            profileImage: true,
          },
        },
      },
    });
  }

  /**
   * 리뷰 삭제
   */
  async delete(id: string) {
    return this.prisma.review.delete({
      where: { id },
    });
  }

  /**
   * 사용자별 평균 평점 및 리뷰 수 계산
   */
  async calculateUserStats(userId: string) {
    const stats = await this.prisma.review.aggregate({
      where: { revieweeId: userId },
      _avg: { rating: true },
      _count: { id: true },
    });

    return {
      averageRating: stats._avg.rating || 0,
      reviewCount: stats._count.id || 0,
    };
  }

  /**
   * 사용자 신뢰도 점수 업데이트
   */
  async updateUserTrustScore(userId: string) {
    const stats = await this.calculateUserStats(userId);

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        averageRating: stats.averageRating,
        reviewCount: stats.reviewCount,
        trustScore: stats.averageRating, // 간단한 버전 (추후 복잡한 로직 적용 가능)
      },
    });
  }
}
```

**작업 항목**:
- [ ] ReviewsRepository 클래스 생성
- [ ] CRUD 메서드 구현
- [ ] 페이지네이션 로직 구현
- [ ] 신뢰도 계산 로직 구현

#### 오후: Service 구현

```typescript
// src/modules/reviews/reviews.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ReviewsRepository } from './repositories/reviews.repository';
import { OrdersRepository } from '../orders/repositories/orders.repository';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { QueryReviewsDto } from './dto/query-reviews.dto';
import { ReviewResponseDto } from './dto/review-response.dto';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly repository: ReviewsRepository,
    private readonly ordersRepository: OrdersRepository,
  ) {}

  /**
   * 리뷰 작성
   *
   * 비즈니스 규칙:
   * 1. 주문이 완료(CONFIRMED) 상태여야 함
   * 2. 주문의 구매자 또는 판매자만 작성 가능
   * 3. 1주문당 1리뷰만 작성 가능
   * 4. 자기 자신에 대한 리뷰는 불가
   */
  async create(userId: string, dto: CreateReviewDto): Promise<ReviewResponseDto> {
    // 1. 주문 존재 및 상태 확인
    const order = await this.ordersRepository.findById(dto.orderId);
    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다');
    }

    // 2. 주문 완료 상태 확인
    if (order.status !== OrderStatus.CONFIRMED) {
      throw new BadRequestException('완료된 주문만 리뷰를 작성할 수 있습니다');
    }

    // 3. 권한 확인 (구매자 또는 판매자)
    const isBuyer = order.buyerId === userId;
    const isSeller = order.sellerId === userId;

    if (!isBuyer && !isSeller) {
      throw new ForbiddenException('이 주문에 대한 리뷰를 작성할 권한이 없습니다');
    }

    // 4. 리뷰 대상자 결정 (구매자 → 판매자, 판매자 → 구매자)
    const revieweeId = isBuyer ? order.sellerId : order.buyerId;

    // 5. 중복 리뷰 확인
    const existingReview = await this.repository.findByOrderId(dto.orderId);
    if (existingReview && existingReview.reviewerId === userId) {
      throw new BadRequestException('이미 이 주문에 대한 리뷰를 작성하셨습니다');
    }

    // 6. 리뷰 생성
    const review = await this.repository.create(userId, {
      ...dto,
      revieweeId,
    });

    // 7. 리뷰 대상자의 신뢰도 점수 업데이트
    await this.repository.updateUserTrustScore(revieweeId);

    return new ReviewResponseDto(review as any);
  }

  /**
   * 리뷰 목록 조회
   */
  async findMany(query: QueryReviewsDto) {
    const result = await this.repository.findMany(query);

    return {
      ...result,
      items: result.items.map(review => new ReviewResponseDto(review as any)),
    };
  }

  /**
   * 리뷰 상세 조회
   */
  async findById(id: string): Promise<ReviewResponseDto> {
    const review = await this.repository.findById(id);

    if (!review) {
      throw new NotFoundException('리뷰를 찾을 수 없습니다');
    }

    return new ReviewResponseDto(review as any);
  }

  /**
   * 주문별 리뷰 조회
   */
  async findByOrderId(orderId: string): Promise<ReviewResponseDto | null> {
    const review = await this.repository.findByOrderId(orderId);

    if (!review) {
      return null;
    }

    return new ReviewResponseDto(review as any);
  }

  /**
   * 리뷰 수정
   *
   * 권한: 작성자 본인만 가능
   */
  async update(
    userId: string,
    id: string,
    dto: UpdateReviewDto,
  ): Promise<ReviewResponseDto> {
    const review = await this.repository.findById(id);

    if (!review) {
      throw new NotFoundException('리뷰를 찾을 수 없습니다');
    }

    // 권한 확인
    if (review.reviewerId !== userId) {
      throw new ForbiddenException('본인이 작성한 리뷰만 수정할 수 있습니다');
    }

    const updated = await this.repository.update(id, dto);

    // 별점이 변경된 경우 신뢰도 점수 재계산
    if (dto.rating && dto.rating !== review.rating) {
      await this.repository.updateUserTrustScore(review.revieweeId);
    }

    return new ReviewResponseDto(updated as any);
  }

  /**
   * 리뷰 삭제
   *
   * 권한: 작성자 본인 또는 관리자
   */
  async delete(userId: string, id: string, isAdmin: boolean = false): Promise<void> {
    const review = await this.repository.findById(id);

    if (!review) {
      throw new NotFoundException('리뷰를 찾을 수 없습니다');
    }

    // 권한 확인
    if (!isAdmin && review.reviewerId !== userId) {
      throw new ForbiddenException('본인이 작성한 리뷰만 삭제할 수 있습니다');
    }

    await this.repository.delete(id);

    // 신뢰도 점수 재계산
    await this.repository.updateUserTrustScore(review.revieweeId);
  }

  /**
   * 사용자별 신뢰도 점수 조회
   */
  async getUserTrustScore(userId: string) {
    return this.repository.calculateUserStats(userId);
  }
}
```

**작업 항목**:
- [ ] ReviewsService 클래스 생성
- [ ] 비즈니스 로직 구현 (권한 검증, 상태 확인)
- [ ] 신뢰도 점수 계산 로직
- [ ] 예외 처리 추가

---

### 📌 Day 3: Controller 및 Module 구현

#### 오전: Controller 구현

```typescript
// src/modules/reviews/reviews.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { QueryReviewsDto } from './dto/query-reviews.dto';
import { ReviewResponseDto } from './dto/review-response.dto';
import { JwtAuthGuard } from 'src/common/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/auth/guards/roles.guard';
import { Roles } from 'src/common/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/common/auth/decorators/current-user.decorator';
import { Role } from 'src/common/auth/enums/role.enum';
import { Public } from 'src/common/auth/decorators/public.decorator';

@ApiTags('reviews')
@Controller('reviews')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /**
   * 리뷰 작성
   */
  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '리뷰 작성' })
  @ApiResponse({
    status: 201,
    description: '리뷰가 성공적으로 작성되었습니다',
    type: ReviewResponseDto,
  })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  @ApiResponse({ status: 404, description: '주문을 찾을 수 없음' })
  async create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    return this.reviewsService.create(userId, dto);
  }

  /**
   * 리뷰 목록 조회 (공개)
   */
  @Get()
  @Public()
  @ApiOperation({ summary: '리뷰 목록 조회' })
  @ApiResponse({
    status: 200,
    description: '리뷰 목록 조회 성공',
    type: [ReviewResponseDto],
  })
  async findMany(@Query() query: QueryReviewsDto) {
    return this.reviewsService.findMany(query);
  }

  /**
   * 리뷰 상세 조회 (공개)
   */
  @Get(':id')
  @Public()
  @ApiOperation({ summary: '리뷰 상세 조회' })
  @ApiResponse({
    status: 200,
    description: '리뷰 조회 성공',
    type: ReviewResponseDto,
  })
  @ApiResponse({ status: 404, description: '리뷰를 찾을 수 없음' })
  async findById(@Param('id') id: string): Promise<ReviewResponseDto> {
    return this.reviewsService.findById(id);
  }

  /**
   * 주문별 리뷰 조회 (공개)
   */
  @Get('order/:orderId')
  @Public()
  @ApiOperation({ summary: '주문별 리뷰 조회' })
  @ApiResponse({
    status: 200,
    description: '리뷰 조회 성공',
    type: ReviewResponseDto,
  })
  async findByOrderId(
    @Param('orderId') orderId: string,
  ): Promise<ReviewResponseDto | null> {
    return this.reviewsService.findByOrderId(orderId);
  }

  /**
   * 사용자 신뢰도 점수 조회 (공개)
   */
  @Get('trust/:userId')
  @Public()
  @ApiOperation({ summary: '사용자 신뢰도 점수 조회' })
  @ApiResponse({
    status: 200,
    description: '신뢰도 점수 조회 성공',
  })
  async getUserTrustScore(@Param('userId') userId: string) {
    return this.reviewsService.getUserTrustScore(userId);
  }

  /**
   * 리뷰 수정
   */
  @Patch(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '리뷰 수정' })
  @ApiResponse({
    status: 200,
    description: '리뷰 수정 성공',
    type: ReviewResponseDto,
  })
  @ApiResponse({ status: 403, description: '권한 없음' })
  @ApiResponse({ status: 404, description: '리뷰를 찾을 수 없음' })
  async update(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
  ): Promise<ReviewResponseDto> {
    return this.reviewsService.update(userId, id, dto);
  }

  /**
   * 리뷰 삭제 (작성자 또는 관리자)
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '리뷰 삭제' })
  @ApiResponse({ status: 204, description: '리뷰 삭제 성공' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  @ApiResponse({ status: 404, description: '리뷰를 찾을 수 없음' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @Param('id') id: string,
  ): Promise<void> {
    const isAdmin = role === Role.ADMIN;
    return this.reviewsService.delete(userId, id, isAdmin);
  }
}
```

#### 오후: Module 구성 및 통합

```typescript
// src/modules/reviews/reviews.module.ts
import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { ReviewsRepository } from './repositories/reviews.repository';
import { PrismaModule } from 'src/prisma/prisma.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [PrismaModule, OrdersModule],
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewsRepository],
  exports: [ReviewsService, ReviewsRepository],
})
export class ReviewsModule {}
```

```typescript
// src/app.module.ts에 추가
import { ReviewsModule } from './modules/reviews/reviews.module';

@Module({
  imports: [
    // ... 기존 imports
    ReviewsModule, // 추가
  ],
})
export class AppModule {}
```

**작업 항목**:
- [ ] ReviewsController 구현 (7개 엔드포인트)
- [ ] Swagger 문서화 데코레이터 추가
- [ ] ReviewsModule 구성
- [ ] AppModule에 ReviewsModule 추가

---

### 📌 Day 4-5: E2E 테스트 작성

```typescript
// test/reviews.e2e.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('ReviewsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let buyerToken: string;
  let sellerToken: string;
  let adminToken: string;
  let buyerId: string;
  let sellerId: string;
  let orderId: string;
  let productId: string;
  let reviewId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // 테스트 사용자 생성 및 로그인
    // 구매자
    const buyerRes = await request(app.getHttpServer())
      .post('/api/v1/users')
      .send({
        email: 'buyer-review@test.com',
        password: 'Test1234!',
        nickname: '구매자',
        role: 'user',
      });
    buyerId = buyerRes.body.data.id;

    const buyerLogin = await request(app.getHttpServer())
      .post('/api/v1/users/login')
      .send({
        email: 'buyer-review@test.com',
        password: 'Test1234!',
      });
    buyerToken = buyerLogin.body.data.accessToken;

    // 판매자
    const sellerRes = await request(app.getHttpServer())
      .post('/api/v1/users')
      .send({
        email: 'seller-review@test.com',
        password: 'Test1234!',
        nickname: '판매자',
        role: 'seller',
      });
    sellerId = sellerRes.body.data.id;

    const sellerLogin = await request(app.getHttpServer())
      .post('/api/v1/users/login')
      .send({
        email: 'seller-review@test.com',
        password: 'Test1234!',
      });
    sellerToken = sellerLogin.body.data.accessToken;

    // 테스트 상품 생성
    const productRes = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        title: '리뷰 테스트 상품',
        description: '테스트용 상품',
        price: 10000,
        categoryId: 'category-id', // 실제 카테고리 ID
      });
    productId = productRes.body.data.id;

    // 테스트 주문 생성 및 완료 처리
    const orderRes = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        productId,
        quantity: 1,
      });
    orderId = orderRes.body.data.id;

    // 주문 상태를 CONFIRMED로 변경 (직접 DB 업데이트)
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'CONFIRMED' },
    });
  });

  afterAll(async () => {
    // 테스트 데이터 정리
    await prisma.review.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['buyer-review@test.com', 'seller-review@test.com'],
        },
      },
    });

    await app.close();
  });

  describe('POST /api/v1/reviews', () => {
    it('구매자가 판매자에게 리뷰를 작성할 수 있어야 함', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          orderId,
          rating: 5,
          comment: '좋은 거래였습니다!',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.rating).toBe(5);
      expect(res.body.data.comment).toBe('좋은 거래였습니다!');

      reviewId = res.body.data.id;
    });

    it('중복 리뷰 작성을 방지해야 함', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          orderId,
          rating: 4,
          comment: '중복 리뷰',
        })
        .expect(400);
    });

    it('완료되지 않은 주문에는 리뷰를 작성할 수 없어야 함', async () => {
      // 새 주문 생성 (PENDING 상태)
      const newOrderRes = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          productId,
          quantity: 1,
        });

      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          orderId: newOrderRes.body.data.id,
          rating: 5,
          comment: '아직 완료되지 않은 주문',
        })
        .expect(400);
    });

    it('인증되지 않은 사용자는 리뷰를 작성할 수 없어야 함', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .send({
          orderId,
          rating: 5,
        })
        .expect(401);
    });

    it('별점은 1-5 사이여야 함', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          orderId,
          rating: 6, // 유효하지 않은 별점
        })
        .expect(400);
    });
  });

  describe('GET /api/v1/reviews', () => {
    it('리뷰 목록을 조회할 수 있어야 함', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/reviews')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data.items.length).toBeGreaterThan(0);
    });

    it('특정 사용자의 리뷰만 조회할 수 있어야 함', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/reviews?revieweeId=${sellerId}`)
        .expect(200);

      expect(res.body.data.items.every(
        (review: any) => review.revieweeId === sellerId
      )).toBe(true);
    });

    it('최소 별점으로 필터링할 수 있어야 함', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/reviews?minRating=4')
        .expect(200);

      expect(res.body.data.items.every(
        (review: any) => review.rating >= 4
      )).toBe(true);
    });

    it('페이지네이션이 동작해야 함', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/reviews?page=1&limit=10')
        .expect(200);

      expect(res.body.data).toHaveProperty('page', 1);
      expect(res.body.data).toHaveProperty('limit', 10);
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('totalPages');
    });
  });

  describe('GET /api/v1/reviews/:id', () => {
    it('리뷰 상세를 조회할 수 있어야 함', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/reviews/${reviewId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(reviewId);
    });

    it('존재하지 않는 리뷰 조회 시 404를 반환해야 함', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/reviews/non-existent-id')
        .expect(404);
    });
  });

  describe('GET /api/v1/reviews/order/:orderId', () => {
    it('주문별 리뷰를 조회할 수 있어야 함', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/reviews/order/${orderId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.orderId).toBe(orderId);
    });
  });

  describe('GET /api/v1/reviews/trust/:userId', () => {
    it('사용자 신뢰도 점수를 조회할 수 있어야 함', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/reviews/trust/${sellerId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('averageRating');
      expect(res.body.data).toHaveProperty('reviewCount');
    });
  });

  describe('PATCH /api/v1/reviews/:id', () => {
    it('리뷰 작성자가 리뷰를 수정할 수 있어야 함', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          rating: 4,
          comment: '수정된 리뷰입니다',
        })
        .expect(200);

      expect(res.body.data.rating).toBe(4);
      expect(res.body.data.comment).toBe('수정된 리뷰입니다');
    });

    it('다른 사용자는 리뷰를 수정할 수 없어야 함', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          rating: 3,
        })
        .expect(403);
    });
  });

  describe('DELETE /api/v1/reviews/:id', () => {
    it('리뷰 작성자가 리뷰를 삭제할 수 있어야 함', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(204);

      // 삭제 확인
      await request(app.getHttpServer())
        .get(`/api/v1/reviews/${reviewId}`)
        .expect(404);
    });

    it('다른 사용자는 리뷰를 삭제할 수 없어야 함', async () => {
      // 새 리뷰 생성
      const newReview = await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          orderId,
          rating: 5,
        });

      await request(app.getHttpServer())
        .delete(`/api/v1/reviews/${newReview.body.data.id}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(403);
    });
  });
});
```

**작업 항목**:
- [ ] E2E 테스트 파일 생성
- [ ] 테스트 데이터 생성 및 정리 로직
- [ ] 10-15개 테스트 케이스 작성
- [ ] 테스트 실행 및 통과 확인

**테스트 실행**:
```bash
# E2E 테스트 실행
npm run test:e2e test/reviews.e2e.spec.ts

# 전체 테스트 실행
npm run test:e2e
```

---

## 📊 Week 11 마무리 체크리스트

### 완료 항목
- [ ] Prisma 스키마 설계 및 마이그레이션
- [ ] 4개 DTO 작성 (Create, Update, Query, Response)
- [ ] ReviewsRepository 구현 (CRUD + 신뢰도 계산)
- [ ] ReviewsService 구현 (비즈니스 로직)
- [ ] ReviewsController 구현 (7개 엔드포인트)
- [ ] ReviewsModule 구성
- [ ] E2E 테스트 10-15개 작성 및 통과

### 산출물
```
✅ Reviews 모듈 완성
✅ 7개 API 엔드포인트
   - POST   /api/v1/reviews           # 리뷰 작성
   - GET    /api/v1/reviews           # 리뷰 목록
   - GET    /api/v1/reviews/:id       # 리뷰 상세
   - GET    /api/v1/reviews/order/:orderId    # 주문별 리뷰
   - GET    /api/v1/reviews/trust/:userId     # 신뢰도 점수
   - PATCH  /api/v1/reviews/:id       # 리뷰 수정
   - DELETE /api/v1/reviews/:id       # 리뷰 삭제

✅ E2E 테스트: 10-15개 (예상)
✅ 신뢰도 시스템 구현
✅ Swagger 문서 자동 생성
```

### 품질 지표
- **코드 품질**: TypeScript strict 모드 통과
- **테스트 커버리지**: E2E 100%
- **API 문서**: Swagger 자동 생성
- **보안**: JWT 인증 + RBAC

---

## 📝 다음 주 미리보기

### Week 12: Messages 모듈
- **Day 1**: MongoDB 스키마 설계
- **Day 2-3**: 메시징 API 구현
- **Day 4-5**: E2E 테스트 작성

**예상 API**:
```
POST   /api/v1/messages              # 메시지 전송
GET    /api/v1/messages/conversations # 채팅방 목록
GET    /api/v1/messages/:conversationId # 메시지 히스토리
PATCH  /api/v1/messages/:id/read     # 읽음 처리
DELETE /api/v1/messages/:id          # 메시지 삭제
```

---

**작성자**: 개발팀
**문서 버전**: v1.0
**최종 업데이트**: 2025-10-24
