import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, Max, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 페이지네이션 요청 DTO
 *
 * 클라이언트로부터 페이지네이션 파라미터를 받기 위한 기본 DTO
 */
export class PaginationDto {
  /**
   * 페이지 번호 (1부터 시작)
   * @default 1
   */
  @ApiPropertyOptional({
    description: '페이지 번호 (1부터 시작)',
    minimum: 1,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '페이지 번호는 정수여야 합니다' })
  @Min(1, { message: '페이지 번호는 1 이상이어야 합니다' })
  page?: number = 1;

  /**
   * 페이지당 항목 수
   * @default 10
   */
  @ApiPropertyOptional({
    description: '페이지당 항목 수',
    minimum: 1,
    maximum: 100,
    default: 10,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit는 정수여야 합니다' })
  @Min(1, { message: 'limit는 1 이상이어야 합니다' })
  @Max(100, { message: 'limit는 100 이하여야 합니다' })
  limit?: number = 10;

  /**
   * 정렬 필드
   */
  @ApiPropertyOptional({
    description: '정렬 필드',
    default: 'createdAt',
    example: 'createdAt',
  })
  @IsOptional()
  @IsString({ message: 'sortBy는 문자열이어야 합니다' })
  sortBy?: string = 'createAt';

  /**
   * 정렬 순서 (ASC 또는 DESC)
   * @default 'DESC'
   */
  @ApiPropertyOptional({
    description: '정렬 순서',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
    example: 'DESC',
  })
  @IsOptional()
  @IsIn(['ASC', 'DESC'], { message: 'sortOrder는 ASC 또는 DESC여야 합니다' })
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

/**
 * 커서 기반 페이지네이션 요청 DTO
 *
 * 무한 스크롤이나 대용량 데이터 페이지네이션에 사용
 */
export class CursorPaginationDto {
  /**
   * 커서 (마지막 항목의 ID 또는 타임스탬프)
   */
  @ApiPropertyOptional({
    description: '커서 (마지막 항목의 ID 또는 타임스탬프)',
    example: '123',
  })
  @IsOptional()
  @IsString({ message: '커서는 문자열이어야 합니다' })
  cursor?: string;

  /**
   * 가져올 항목 수
   * @default 20
   */
  @ApiPropertyOptional({
    description: '가져올 항목 수',
    minimum: 1,
    maximum: 100,
    default: 20,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit는 정수여야 합니다' })
  @Min(1, { message: 'limit는 1 이상이어야 합니다' })
  @Max(100, { message: 'limit는 100 이하여야 합니다' })
  limit?: number = 20;

  /**
   * 정렬 순서 (ASC 또는 DESC)
   * @default 'DESC'
   */
  @ApiPropertyOptional({
    description: '정렬 순서',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
    example: 'DESC',
  })
  @IsOptional()
  @IsIn(['ASC', 'DESC'], { message: 'sortOrder는 ASC 또는 DESC여야 합니다' })
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
