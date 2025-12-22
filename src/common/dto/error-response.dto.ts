import { ApiProperty } from '@nestjs/swagger';

/**
 * 에러 상세 정보 (중첩 객체)
 */
export class ErrorDetail {
  @ApiProperty({
    description: '에러 코드 (기계가 읽을 수 있는 식별자)',
    example: 'VALIDATION_ERROR',
  })
  code: string;

  @ApiProperty({
    description: '에러 메시지 (사용자에게 표시할 메시지)',
    oneOf: [
      { type: 'string', example: '잘못된 요청입니다' },
      {
        type: 'array',
        items: { type: 'string' },
        example: ['이메일은 필수입니다', '비밀번호는 8자 이상이어야 합니다'],
      },
    ],
  })
  message: string | string[];

  @ApiProperty({
    description: '추가 에러 상세 정보',
    required: false,
    example: 'Bad Request',
  })
  details?: string | any;
}

/**
 * 표준 에러 응답 DTO (Google/Microsoft 스타일)
 *
 * 중첩 구조로 확장성과 명확성을 확보
 */
export class ErrorResponseDto {
  @ApiProperty({
    description: '성공 여부',
    example: false,
  })
  success: boolean;

  @ApiProperty({
    description: 'HTTP 상태 코드',
    example: 400,
  })
  statusCode: number;

  @ApiProperty({
    description: '에러 정보 객체',
    type: ErrorDetail,
  })
  error: ErrorDetail;

  @ApiProperty({
    description: '타임스탬프 (ISO 8601)',
    example: '2025-12-18T10:30:00Z',
  })
  timestamp: string;

  @ApiProperty({
    description: '요청 경로',
    example: '/api/v1/users',
    required: false,
  })
  path?: string;
}

/**
 * Validation 에러 응답 DTO
 *
 * ValidationPipe에서 발생하는 에러 (message가 배열)
 */
export class ValidationErrorResponseDto {
  @ApiProperty({
    description: '성공 여부',
    example: false,
  })
  success: boolean;

  @ApiProperty({
    description: 'HTTP 상태 코드',
    example: 400,
  })
  statusCode: number;

  @ApiProperty({
    description: '에러 정보 객체',
    example: {
      code: 'VALIDATION_ERROR',
      message: ['이메일은 필수입니다', '비밀번호는 8자 이상이어야 합니다'],
      details: 'Bad Request',
    },
  })
  error: ErrorDetail;

  @ApiProperty({
    description: '타임스탬프 (ISO 8601)',
    example: '2025-12-18T10:30:00Z',
  })
  timestamp: string;

  @ApiProperty({
    description: '요청 경로',
    example: '/api/v1/users',
    required: false,
  })
  path?: string;
}

/**
 * Unauthorized 에러 응답 DTO
 *
 * 인증 실패 시 응답 (401)
 */
export class UnauthorizedErrorResponseDto {
  @ApiProperty({
    description: '성공 여부',
    example: false,
  })
  success: boolean;

  @ApiProperty({
    description: 'HTTP 상태 코드',
    example: 401,
  })
  statusCode: number;

  @ApiProperty({
    description: '에러 정보 객체',
    example: {
      code: 'UNAUTHORIZED',
      message: '인증이 필요합니다',
      details: 'Unauthorized',
    },
  })
  error: ErrorDetail;

  @ApiProperty({
    description: '타임스탬프 (ISO 8601)',
    example: '2025-12-18T10:30:00Z',
  })
  timestamp: string;

  @ApiProperty({
    description: '요청 경로',
    example: '/api/v1/auth/login',
    required: false,
  })
  path?: string;
}

/**
 * Forbidden 에러 응답 DTO
 *
 * 권한 부족 시 응답 (403)
 */
export class ForbiddenErrorResponseDto {
  @ApiProperty({
    description: '성공 여부',
    example: false,
  })
  success: boolean;

  @ApiProperty({
    description: 'HTTP 상태 코드',
    example: 403,
  })
  statusCode: number;

  @ApiProperty({
    description: '에러 정보 객체',
    example: {
      code: 'FORBIDDEN',
      message: '접근 권한이 없습니다',
      details: 'Forbidden',
    },
  })
  error: ErrorDetail;

  @ApiProperty({
    description: '타임스탬프 (ISO 8601)',
    example: '2025-12-18T10:30:00Z',
  })
  timestamp: string;

  @ApiProperty({
    description: '요청 경로',
    example: '/api/v1/admin/users',
    required: false,
  })
  path?: string;
}

/**
 * Rate Limit 에러 응답 DTO
 *
 * Rate Limiting 초과 시 응답 (429)
 */
export class RateLimitErrorResponseDto {
  @ApiProperty({
    description: '성공 여부',
    example: false,
  })
  success: boolean;

  @ApiProperty({
    description: 'HTTP 상태 코드',
    example: 429,
  })
  statusCode: number;

  @ApiProperty({
    description: '에러 정보 객체',
    example: {
      code: 'TOO_MANY_REQUESTS',
      message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      details: 'Too Many Requests',
    },
  })
  error: ErrorDetail;

  @ApiProperty({
    description: '타임스탬프 (ISO 8601)',
    example: '2025-12-18T10:30:00Z',
  })
  timestamp: string;

  @ApiProperty({
    description: '재시도 가능 시간 (초)',
    example: 60,
    required: false,
  })
  retryAfter?: number;

  @ApiProperty({
    description: '요청 경로',
    example: '/api/v1/products',
    required: false,
  })
  path?: string;
}
