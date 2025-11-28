import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min, Max, IsOptional } from 'class-validator';

/**
 * 페이지네이션 쿼리 DTO
 */
export class PaginationQueryDto {
  @ApiProperty({
    description: '페이지 번호',
    example: 1,
    minimum: 1,
    default: 1,
    required: false,
  })
  @Type(() => Number)
  @IsInt({ message: '페이지는 정수여야 합니다' })
  @Min(1, { message: '페이지는 1 이상이어야 합니다' })
  @IsOptional()
  page?: number = 1;

  @ApiProperty({
    description: '페이지당 항목 수',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
    required: false,
  })
  @Type(() => Number)
  @IsInt({ message: '제한값은 정수여야 합니다' })
  @Min(1, { message: '최소 1개 이상이어야 합니다' })
  @Max(100, { message: '최대 100개까지만 가능합니다' })
  @IsOptional()
  limit?: number = 20;
}
