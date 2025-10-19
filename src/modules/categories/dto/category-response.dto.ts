import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

/**
 * 카테고리 개수 정보 DTO
 */
export class CategoryCountDto {
  @ApiProperty({ description: '상품 개수', example: 150 })
  @Expose()
  products: number;

  @ApiProperty({ description: '하위 카테고리 개수', example: 5 })
  @Expose()
  children: number;
}

/**
 * 부모 카테고리 정보 DTO (간략한 정보만)
 */
export class ParentCategoryDto {
  @ApiProperty({
    description: '카테고리 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @Expose()
  id: string;

  @ApiProperty({ description: '카테고리 이름', example: '전자기기' })
  @Expose()
  name: string;

  @ApiProperty({ description: 'URL 슬러그', example: 'electronics' })
  @Expose()
  slug: string;
}

/**
 * 카테고리 응답 DTO
 */
export class CategoryResponseDto {
  @ApiProperty({
    description: '카테고리 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @Expose()
  id: string;

  @ApiProperty({ description: '카테고리 이름', example: '노트북' })
  @Expose()
  name: string;

  @ApiProperty({ description: 'URL 슬러그', example: 'laptops' })
  @Expose()
  slug: string;

  @ApiPropertyOptional({
    description: '아이콘 URL',
    example: 'https://cdn.example.com/icons/laptops.svg',
  })
  @Expose()
  icon?: string;

  @ApiProperty({ description: '표시 순서', example: 0 })
  @Expose()
  order: number;

  @ApiProperty({ description: '활성화 상태', example: true })
  @Expose()
  isActive: boolean;

  @ApiPropertyOptional({ description: '부모 카테고리 ID' })
  @Expose()
  parentId?: string;

  @ApiPropertyOptional({ description: '부모 카테고리 정보', type: ParentCategoryDto })
  @Expose()
  @Type(() => ParentCategoryDto)
  parent?: ParentCategoryDto;

  @ApiPropertyOptional({
    description: '하위 카테고리 목록',
    type: () => [CategoryResponseDto],
  })
  @Expose()
  @Type(() => CategoryResponseDto)
  children?: CategoryResponseDto[];

  @ApiPropertyOptional({ description: '개수 정보', type: CategoryCountDto })
  @Expose()
  @Type(() => CategoryCountDto)
  _count?: CategoryCountDto;

  @ApiProperty({ description: '생성일시' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ description: '수정일시' })
  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<CategoryResponseDto>) {
    Object.assign(this, partial);
  }
}
