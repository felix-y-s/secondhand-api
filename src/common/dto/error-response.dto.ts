import { ApiProperty } from '@nestjs/swagger';

/**
 * 에러 응답 DTO
 *
 * API 에러 발생 시 표준 응답 포맷
 */
export class ErrorResponseDto {
  @ApiProperty({
    description: 'HTTP 상태 코드',
    example: 400,
  })
  statusCode: number;

  @ApiProperty({
    description: '에러 메시지',
    example: '잘못된 요청입니다',
  })
  message: string;

  @ApiProperty({
    description: '에러 코드',
    example: 'BAD_REQUEST',
  })
  error: string;

  @ApiProperty({
    description: '타임스탬프',
    example: '2025-10-17T10:30:00Z',
  })
  timestamp: string;

  @ApiProperty({
    description: '요청 경로',
    example: '/api/v1/users',
  })
  path: string;
}

/**
 * Validation 에러 응답 DTO
 *
 * 요청 데이터 검증 실패 시 응답 포맷
 */
export class ValidationErrorResponseDto extends ErrorResponseDto {
  @ApiProperty({
    description: 'Validation 에러 상세 정보',
    example: [
      {
        field: 'email',
        message: '이메일 형식이 올바르지 않습니다',
      },
      {
        field: 'password',
        message: '비밀번호는 8자 이상이어야 합니다',
      },
    ],
  })
  details: Array<{
    field: string;
    message: string;
  }>;
}

/**
 * Unauthorized 에러 응답 DTO
 *
 * 인증 실패 시 응답 포맷
 */
export class UnauthorizedErrorResponseDto {
  @ApiProperty({
    description: 'HTTP 상태 코드',
    example: 401,
  })
  statusCode: number;

  @ApiProperty({
    description: '에러 메시지',
    example: '인증이 필요합니다',
  })
  message: string;

  @ApiProperty({
    description: '에러 코드',
    example: 'UNAUTHORIZED',
  })
  error: string;
}

/**
 * Forbidden 에러 응답 DTO
 *
 * 권한 부족 시 응답 포맷
 */
export class ForbiddenErrorResponseDto {
  @ApiProperty({
    description: 'HTTP 상태 코드',
    example: 403,
  })
  statusCode: number;

  @ApiProperty({
    description: '에러 메시지',
    example: '접근 권한이 없습니다',
  })
  message: string;

  @ApiProperty({
    description: '에러 코드',
    example: 'FORBIDDEN',
  })
  error: string;
}

/**
 * Rate Limit 에러 응답 DTO
 *
 * Rate Limiting 초과 시 응답 포맷
 */
export class RateLimitErrorResponseDto {
  @ApiProperty({
    description: 'HTTP 상태 코드',
    example: 429,
  })
  statusCode: number;

  @ApiProperty({
    description: '에러 메시지',
    example: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  })
  message: string;

  @ApiProperty({
    description: '에러 코드',
    example: 'TOO_MANY_REQUESTS',
  })
  error: string;

  @ApiProperty({
    description: '재시도 가능 시간 (초)',
    example: 60,
    required: false,
  })
  retryAfter?: number;
}
