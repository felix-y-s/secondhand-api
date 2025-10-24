import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * 리뷰 목록 조회 DTO
 */
export class QueryReviewsDto {
  @ApiPropertyOptional({
    description: '리뷰 작성자 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString({ message: '리뷰 작성자 ID는 문자열이어야 합니다' })
  reviewerId?: string;

  @ApiPropertyOptional({
    description: '리뷰 대상자 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString({ message: '리뷰 대상자 ID는 문자열이어야 합니다' })
  reviewedId?: string;

  @ApiPropertyOptional({
    description: '최소 평점',
    example: 1,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '최소 평점은 정수여야 합니다' })
  @Min(1, { message: '최소 평점은 1 이상이어야 합니다' })
  @Max(5, { message: '최소 평점은 5 이하여야 합니다' })
  minRating?: number;

  @ApiPropertyOptional({
    description: '최대 평점',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '최대 평점은 정수여야 합니다' })
  @Min(1, { message: '최대 평점은 1 이상이어야 합니다' })
  @Max(5, { message: '최대 평점은 5 이하여야 합니다' })
  maxRating?: number;

  @ApiPropertyOptional({
    description: '페이지 번호',
    example: 1,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '페이지 번호는 정수여야 합니다' })
  @Min(1, { message: '페이지 번호는 1 이상이어야 합니다' })
  page?: number = 1;

  @ApiPropertyOptional({
    description: '페이지 크기',
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '페이지 크기는 정수여야 합니다' })
  @Min(1, { message: '페이지 크기는 최소 1입니다' })
  @Max(100, { message: '페이지 크기는 최대 100입니다' })
  limit?: number = 20;
}
