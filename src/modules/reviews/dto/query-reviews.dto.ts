import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaginationDto } from '@/common/dto';

/**
 * 리뷰 목록 조회 DTO
 */
export class QueryReviewsDto extends PaginationDto {
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
}
