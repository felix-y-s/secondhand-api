import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from './pagination.dto';

/**
 * 검색 쿼리 DTO
 *
 * 검색 기능이 필요한 엔드포인트에서 페이지네이션과 함께 사용
 */
export class SearchDto extends PaginationDto {
  /**
   * 검색 키워드
   */
  @ApiPropertyOptional({
    description: '검색 키워드',
    minLength: 1,
    maxLength: 100,
    example: '아이폰',
  })
  @IsOptional()
  @IsString({ message: '검색 키워드는 문자열이어야 합니다' })
  @MinLength(1, { message: '검색 키워드는 최소 1자 이상이어야 합니다' })
  @MaxLength(100, { message: '검색 키워드는 최대 100자까지 가능합니다' })
  keyword?: string;

  /**
   * 검색 대상 필드
   */
  @ApiPropertyOptional({
    description: '검색 대상 필드 (쉼표로 구분)',
    example: 'title,description',
  })
  @IsOptional()
  @IsString({ message: '검색 필드는 문자열이어야 합니다' })
  searchFields?: string;
}

/**
 * 날짜 범위 검색 DTO
 *
 * 날짜 범위로 필터링이 필요한 엔드포인트에서 사용
 */
export class DateRangeSearchDto extends SearchDto {
  /**
   * 시작 날짜 (ISO 8601 형식)
   */
  @ApiPropertyOptional({
    description: '시작 날짜 (ISO 8601 형식)',
    example: '2025-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsString({ message: '시작 날짜는 문자열이어야 합니다' })
  startDate?: string;

  /**
   * 종료 날짜 (ISO 8601 형식)
   */
  @ApiPropertyOptional({
    description: '종료 날짜 (ISO 8601 형식)',
    example: '2025-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsString({ message: '종료 날짜는 문자열이어야 합니다' })
  endDate?: string;
}
