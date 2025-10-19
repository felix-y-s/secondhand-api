import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsEnum,
  IsLatitude,
  IsLongitude,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductStatus } from '@prisma/client';

/**
 * 상품 검색 쿼리 DTO
 */
export class SearchProductDto {
  @ApiProperty({
    description: '검색 키워드 (제목, 설명에서 검색)',
    example: 'iPhone',
    required: false,
  })
  @IsString()
  @IsOptional()
  keyword?: string;

  @ApiProperty({
    description: '카테고리 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiProperty({
    description: '최소 가격 (원)',
    example: 100000,
    minimum: 0,
    required: false,
  })
  @IsNumber()
  @Min(0, { message: '최소 가격은 0원 이상이어야 합니다' })
  @Type(() => Number)
  @IsOptional()
  minPrice?: number;

  @ApiProperty({
    description: '최대 가격 (원)',
    example: 1000000,
    minimum: 0,
    required: false,
  })
  @IsNumber()
  @Min(0, { message: '최대 가격은 0원 이상이어야 합니다' })
  @Type(() => Number)
  @IsOptional()
  maxPrice?: number;

  @ApiProperty({
    description: '판매 상태',
    enum: ProductStatus,
    example: ProductStatus.ACTIVE,
    required: false,
  })
  @IsEnum(ProductStatus, { message: '유효한 판매 상태를 선택해주세요' })
  @IsOptional()
  status?: ProductStatus;

  @ApiProperty({
    description: '판매자 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsString()
  @IsOptional()
  sellerId?: string;

  @ApiProperty({
    description: '위도 (위치 기반 검색)',
    example: 37.5665,
    required: false,
  })
  @IsLatitude({ message: '유효한 위도를 입력해주세요 (-90 ~ 90)' })
  @Type(() => Number)
  @IsOptional()
  latitude?: number;

  @ApiProperty({
    description: '경도 (위치 기반 검색)',
    example: 126.978,
    required: false,
  })
  @IsLongitude({ message: '유효한 경도를 입력해주세요 (-180 ~ 180)' })
  @Type(() => Number)
  @IsOptional()
  longitude?: number;

  @ApiProperty({
    description: '검색 반경 (km)',
    example: 5,
    minimum: 1,
    maximum: 50,
    required: false,
    default: 5,
  })
  @IsNumber()
  @Min(1, { message: '검색 반경은 최소 1km 이상이어야 합니다' })
  @Max(50, { message: '검색 반경은 최대 50km 이하여야 합니다' })
  @Type(() => Number)
  @IsOptional()
  radiusKm?: number = 5;

  @ApiProperty({
    description: '페이지 번호 (1부터 시작)',
    example: 1,
    minimum: 1,
    required: false,
    default: 1,
  })
  @IsNumber()
  @Min(1, { message: '페이지 번호는 1 이상이어야 합니다' })
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({
    description: '페이지당 항목 수',
    example: 20,
    minimum: 1,
    maximum: 100,
    required: false,
    default: 20,
  })
  @IsNumber()
  @Min(1, { message: '페이지당 항목 수는 최소 1개 이상이어야 합니다' })
  @Max(100, { message: '페이지당 항목 수는 최대 100개 이하여야 합니다' })
  @Type(() => Number)
  @IsOptional()
  limit?: number = 20;
}
