import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  MaxLength,
  IsArray,
  IsUrl,
  IsEnum,
  IsLatitude,
  IsLongitude,
} from 'class-validator';
import { ProductStatus, ProductCondition } from '@prisma/client';

/**
 * 상품 정보 수정 DTO
 */
export class UpdateProductDto {
  @ApiProperty({
    description: '상품 제목',
    example: 'iPhone 13 Pro 256GB (가격 인하)',
    maxLength: 100,
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100, { message: '제목은 최대 100자 이하여야 합니다' })
  title?: string;

  @ApiProperty({
    description: '상품 설명',
    example: '가격 협상 가능합니다.',
    maxLength: 2000,
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(2000, { message: '설명은 최대 2000자 이하여야 합니다' })
  description?: string;

  @ApiProperty({
    description: '가격 (원)',
    example: 800000,
    minimum: 0,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Min(0, { message: '가격은 0원 이상이어야 합니다' })
  price?: number;

  @ApiProperty({
    description: '카테고리 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiProperty({
    description: '상품 상태',
    enum: ProductCondition,
    example: ProductCondition.LIKE_NEW,
    required: false,
  })
  @IsEnum(ProductCondition, { message: '유효한 상품 상태를 선택해주세요' })
  @IsOptional()
  condition?: ProductCondition;

  @ApiProperty({
    description: '판매 상태',
    enum: ProductStatus,
    example: ProductStatus.SOLD,
    required: false,
  })
  @IsEnum(ProductStatus, { message: '유효한 판매 상태를 선택해주세요' })
  @IsOptional()
  status?: ProductStatus;

  @ApiProperty({
    description: '상품 이미지 URL 목록',
    example: [
      'https://example.com/images/product1.jpg',
      'https://example.com/images/product2.jpg',
    ],
    required: false,
    type: [String],
  })
  @IsArray()
  @IsUrl({}, { each: true, message: '유효한 URL을 입력해주세요' })
  @IsOptional()
  images?: string[];

  @ApiProperty({
    description: '위도 (거래 위치)',
    example: 37.5665,
    required: false,
  })
  @IsLatitude({ message: '유효한 위도를 입력해주세요 (-90 ~ 90)' })
  @IsOptional()
  latitude?: number;

  @ApiProperty({
    description: '경도 (거래 위치)',
    example: 126.978,
    required: false,
  })
  @IsLongitude({ message: '유효한 경도를 입력해주세요 (-180 ~ 180)' })
  @IsOptional()
  longitude?: number;

  @ApiProperty({
    description: '거래 지역명',
    example: '서울시 강남구 역삼동',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(200, { message: '거래 지역명은 최대 200자 이하여야 합니다' })
  location?: string;
}
