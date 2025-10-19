import { ApiProperty } from '@nestjs/swagger';
import { ProductStatus, ProductCondition } from '@prisma/client';
import { Expose, Type } from 'class-transformer';

/**
 * 판매자 정보 (간략)
 */
export class SellerInfoDto {
  @ApiProperty({
    description: '판매자 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: '판매자 닉네임',
    example: '신뢰판매자',
  })
  @Expose()
  nickname: string;

  @ApiProperty({
    description: '프로필 이미지 URL',
    example: 'https://example.com/profile.jpg',
    nullable: true,
  })
  @Expose()
  profileImage: string | null;

  @ApiProperty({
    description: '평점',
    example: 4.5,
  })
  @Expose()
  rating: number;

  @ApiProperty({
    description: '평점 수',
    example: 10,
  })
  @Expose()
  ratingCount: number;
}

/**
 * 카테고리 정보 (간략)
 */
export class CategoryInfoDto {
  @ApiProperty({
    description: '카테고리 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: '카테고리 이름',
    example: '전자기기',
  })
  @Expose()
  name: string;

  @ApiProperty({
    description: '카테고리 슬러그',
    example: 'electronics',
  })
  @Expose()
  slug: string;
}

/**
 * 상품 정보 응답 DTO
 */
export class ProductResponseDto {
  @ApiProperty({
    description: '상품 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: '상품 제목',
    example: 'iPhone 13 Pro 256GB',
  })
  @Expose()
  title: string;

  @ApiProperty({
    description: '상품 설명',
    example: '작년에 구매한 iPhone 13 Pro 256GB입니다.',
  })
  @Expose()
  description: string;

  @ApiProperty({
    description: '가격 (원)',
    example: 850000,
  })
  @Expose()
  price: number;

  @ApiProperty({
    description: '상품 상태',
    enum: ProductCondition,
    example: ProductCondition.LIKE_NEW,
  })
  @Expose()
  condition: ProductCondition;

  @ApiProperty({
    description: '판매 상태',
    enum: ProductStatus,
    example: ProductStatus.ACTIVE,
  })
  @Expose()
  status: ProductStatus;

  @ApiProperty({
    description: '상품 이미지 URL 목록',
    example: ['https://example.com/images/product1.jpg'],
    type: [String],
  })
  @Expose()
  images: string[];

  @ApiProperty({
    description: '위도 (거래 위치)',
    example: 37.5665,
    nullable: true,
  })
  @Expose()
  latitude: number | null;

  @ApiProperty({
    description: '경도 (거래 위치)',
    example: 126.978,
    nullable: true,
  })
  @Expose()
  longitude: number | null;

  @ApiProperty({
    description: '거래 지역명',
    example: '서울시 강남구 역삼동',
    nullable: true,
  })
  @Expose()
  location: string | null;

  @ApiProperty({
    description: '조회수',
    example: 150,
  })
  @Expose()
  viewCount: number;

  @ApiProperty({
    description: '관심 등록 수',
    example: 5,
  })
  @Expose()
  wishlistCount: number;

  @ApiProperty({
    description: '생성일시',
    example: '2024-01-01T00:00:00.000Z',
  })
  @Expose()
  createdAt: Date;

  @ApiProperty({
    description: '수정일시',
    example: '2024-01-01T00:00:00.000Z',
  })
  @Expose()
  updatedAt: Date;

  @ApiProperty({
    description: '판매자 정보',
    type: SellerInfoDto,
  })
  @Expose()
  @Type(() => SellerInfoDto)
  seller: SellerInfoDto;

  @ApiProperty({
    description: '카테고리 정보',
    type: CategoryInfoDto,
  })
  @Expose()
  @Type(() => CategoryInfoDto)
  category: CategoryInfoDto;
}

/**
 * 상품 목록 응답 DTO (페이지네이션 포함)
 */
export class ProductListResponseDto {
  @ApiProperty({
    description: '상품 목록',
    type: [ProductResponseDto],
  })
  items: any[];

  @ApiProperty({
    description: '전체 항목 수',
    example: 100,
  })
  total: number;

  @ApiProperty({
    description: '현재 페이지',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: '페이지당 항목 수',
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: '전체 페이지 수',
    example: 5,
  })
  totalPages: number;
}
