import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMeta, Response } from '../types';
import { plainToInstance } from 'class-transformer';

/**
 * 응답 DTO 사용 가이드
 *
 * 일반적으로 응답 래핑은 TransformInterceptor가 자동으로 처리하므로 DTO 클래스는 불필요합니다.
 * 다음 경우에만 응답 DTO 클래스를 사용하세요:
 *
 * 1. 필드 제외/변환이 필요한 경우 (class-transformer 데코레이터 사용)
 *    - @Exclude(): 응답에서 특정 필드 제외 (예: password)
 *    - @Expose(): 특정 필드만 노출
 *    - @Transform(): 필드 값 변환 (예: 대문자 변환, 날짜 포맷)
 *    - ClassSerializerInterceptor와 함께 사용
 *
 * 2. Swagger 문서화가 필요한 경우
 *    - ⚠️ 하지만 커스텀 데코레이터(@ApiSuccessResponse)를 사용하는 것이 더 권장됨
 *
 * @example
 * // 응답 DTO 사용 예시
 * export class UserResponseDto {
 *   @Expose() id: string;
 *   @Expose() email: string;
 *   @Exclude() password: string; // 응답에서 제외
 *   @Transform(({ value }) => value.toUpperCase())
 *   name: string;
 * }
 *
 * @Controller('users')
 * export class UserController {
 *   @Get()
 *   @UseInterceptors(ClassSerializerInterceptor)
 *   async getUsers(): Promise<UserResponseDto[]> {
 *     const users = await this.service.getUsers();
 *     return users.map(user => plainToClass(UserResponseDto, user));
 *   }
 * }
 */

/**
 * 페이지네이션 메타데이터
 * TODO: swagger 데코레이터로 전환 필요, 아래 응답 dto 클래스 모두 해당
 */
export class PaginationMetaDto implements PaginationMeta {
  @ApiProperty({ description: '전체 항목 수', example: 100 })
  total: number;

  @ApiProperty({ description: '현재 페이지 번호', example: 1 })
  page: number;

  @ApiProperty({ description: '페이지당 항목 수', example: 10 })
  limit: number;

  @ApiProperty({ description: '전체 페이지 수', example: 10 })
  totalPages: number;

  @ApiProperty({ description: '다음 페이지 존재 여부', example: true })
  hasNextPage: boolean;

  @ApiProperty({ description: '이전 페이지 존재 여부', example: false })
  hasPreviousPage: boolean;

  @ApiPropertyOptional({
    description: '다음 페이지 번호',
    example: 2,
    nullable: true,
  })
  nextPage: number | null;

  @ApiPropertyOptional({
    description: '이전 페이지 번호',
    example: null,
    nullable: true,
  })
  previousPage: number | null;
}

/**
 * 표준 API 응답 포맷
 *
 * 모든 API 응답은 이 형식을 따릅니다
 */
export class ResponseDto<T> implements Response<T> {
  @ApiProperty({ description: '성공 여부', example: true })
  success: boolean;

  @ApiProperty({ description: 'HTTP 상태 코드', example: 200 })
  statusCode: number;

  @ApiPropertyOptional({
    description: '응답 메시지',
    example: '요청이 성공적으로 처리되었습니다',
  })
  message?: string;

  @ApiPropertyOptional({ description: '응답 데이터' })
  data?: T;

  @ApiPropertyOptional({ description: '에러 정보' })
  error?: {
    code: string;
    message: string;
    details?: any;
  };

  @ApiPropertyOptional({
    description: '타임스탬프',
    example: '2025-10-17T10:30:00Z',
  })
  timestamp?: string;

  constructor(
    success: boolean,
    statusCode: number,
    data?: T,
    message?: string,
    error?: any,
  ) {
    this.success = success;
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.error = error;
    this.timestamp = new Date().toISOString();
  }

  /**
   * 성공 응답 생성
   */
  static success<T>(
    data?: T,
    statusCode: number = 200,
    message?: string,
  ): ResponseDto<T> {
    return new ResponseDto(true, statusCode, data, message);
  }

  /**
   * 실패 응답 생성
   */
  static error<T = any>(
    error: { code: string; message: string; details?: any },
    statusCode: number = 500,
    message?: string,
  ): ResponseDto<T> {
    return new ResponseDto(false, statusCode, undefined as T, message, error);
  }
}

/**
 * 페이지네이션 응답 포맷
 */
export class PaginatedResponseDto<T> extends ResponseDto<T[]> {
  @ApiProperty({ description: '페이지네이션 메타데이터' })
  meta: PaginationMetaDto;

  constructor(data: T[], meta: PaginationMetaDto, message?: string) {
    const statusCode = 200;
    super(true, statusCode, data, message);
    this.meta = meta;
  }

  /**
   * 페이지네이션 응답 생성
   */
  static create<T>(
    data: T[],
    meta: PaginationMetaDto,
    message?: string,
  ): PaginatedResponseDto<T> {
    return new PaginatedResponseDto(data, meta, message);
  }
}

/**
 * 커서 기반 페이지네이션 응답 포맷
 */
export class CursorPaginatedResponseDto<T> extends ResponseDto<T[]> {
  @ApiPropertyOptional({
    description: '다음 커서',
    example: '123',
    nullable: true,
  })
  nextCursor: string | number | null;

  @ApiProperty({ description: '다음 페이지 존재 여부', example: true })
  hasNextPage: boolean;

  constructor(
    data: T[],
    nextCursor: string | number | null,
    hasNextPage: boolean,
    message?: string,
  ) {
    const statusCode = 200;
    super(true, statusCode, data, message);
    this.nextCursor = nextCursor;
    this.hasNextPage = hasNextPage;
  }

  /**
   * 커서 페이지네이션 응답 생성
   */
  static create<T>(
    data: T[],
    nextCursor: string | number | null,
    hasNextPage: boolean,
    message?: string,
  ): CursorPaginatedResponseDto<T> {
    return new CursorPaginatedResponseDto(
      data,
      nextCursor,
      hasNextPage,
      message,
    );
  }
}

/**
 * ID 응답 DTO
 *
 * 생성/수정 작업 후 ID만 반환할 때 사용
 */
export class IdResponseDto {
  @ApiProperty({
    description: '생성/수정된 항목의 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string | number;

  constructor(id: string | number) {
    this.id = id;
  }
}

/**
 * 성공 응답 DTO
 *
 * 단순 성공 응답이 필요할 때 사용
 */
export class SuccessResponseDto {
  @ApiProperty({ description: '성공 여부', example: true })
  success: boolean = true;

  @ApiPropertyOptional({
    description: '응답 메시지',
    example: '작업이 성공적으로 완료되었습니다',
  })
  message?: string;

  constructor(message?: string) {
    this.message = message;
  }
}
