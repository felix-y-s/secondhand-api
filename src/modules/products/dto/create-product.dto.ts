import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
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
 * 상품 등록 DTO
 */
export class CreateProductDto {
  @ApiProperty({
    description: '상품 제목',
    example: 'iPhone 13 Pro 256GB',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty({ message: '제목은 필수입니다' })
  @MaxLength(100, { message: '제목은 최대 100자 이하여야 합니다' })
  title: string;

  @ApiProperty({
    description: '상품 설명',
    example: '작년에 구매한 iPhone 13 Pro 256GB입니다. 사용감 거의 없고 액정보호필름과 케이스 포함입니다.',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty({ message: '설명은 필수입니다' })
  @MaxLength(2000, { message: '설명은 최대 2000자 이하여야 합니다' })
  description: string;

  @ApiProperty({
    description: '가격 (원)',
    example: 850000,
    minimum: 0,
  })
  @IsNumber()
  @IsNotEmpty({ message: '가격은 필수입니다' })
  @Min(0, { message: '가격은 0원 이상이어야 합니다' })
  price: number;

  @ApiProperty({
    description: '카테고리 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty({ message: '카테고리는 필수입니다' })
  categoryId: string;

  @ApiProperty({
    description: '상품 상태',
    enum: ProductCondition,
    example: ProductCondition.LIKE_NEW,
  })
  @IsEnum(ProductCondition, { message: '유효한 상품 상태를 선택해주세요' })
  @IsNotEmpty({ message: '상품 상태는 필수입니다' })
  condition: ProductCondition;

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
