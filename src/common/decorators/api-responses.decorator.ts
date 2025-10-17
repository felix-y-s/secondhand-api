import { applyDecorators, Type } from '@nestjs/common';
import { ApiResponse, ApiResponseOptions } from '@nestjs/swagger';
import {
  ErrorResponseDto,
  ValidationErrorResponseDto,
  UnauthorizedErrorResponseDto,
  ForbiddenErrorResponseDto,
  RateLimitErrorResponseDto,
} from '../dto/error-response.dto';

/**
 * 표준 API 응답 데코레이터
 *
 * 성공 및 공통 에러 응답을 자동으로 추가합니다
 *
 * @param successStatus - 성공 상태 코드 (기본: 200)
 * @param successType - 성공 응답 타입
 * @param successDescription - 성공 응답 설명
 * @param options - 추가 옵션
 */
export function ApiStandardResponses(
  successStatus: number = 200,
  successType?: Type<any> | Function | [Function] | string,
  successDescription: string = '요청이 성공적으로 처리되었습니다',
  options: {
    includeValidation?: boolean;
    includeAuth?: boolean;
    includeRateLimit?: boolean;
  } = {},
) {
  const decorators: MethodDecorator[] = [
    // 성공 응답
    ApiResponse({
      status: successStatus,
      description: successDescription,
      type: successType,
    }),
  ];

  // Validation 에러 (400)
  if (options.includeValidation !== false) {
    decorators.push(
      ApiResponse({
        status: 400,
        description: '잘못된 요청 (Validation 실패)',
        type: ValidationErrorResponseDto,
      }),
    );
  }

  // 인증 에러 (401)
  if (options.includeAuth !== false) {
    decorators.push(
      ApiResponse({
        status: 401,
        description: '인증 실패 (JWT 토큰 없음 또는 만료)',
        type: UnauthorizedErrorResponseDto,
      }),
    );
  }

  // 권한 에러 (403)
  if (options.includeAuth !== false) {
    decorators.push(
      ApiResponse({
        status: 403,
        description: '권한 부족 (접근 권한 없음)',
        type: ForbiddenErrorResponseDto,
      }),
    );
  }

  // Rate Limit 에러 (429)
  if (options.includeRateLimit !== false) {
    decorators.push(
      ApiResponse({
        status: 429,
        description: 'Rate Limit 초과 (요청 횟수 제한)',
        type: RateLimitErrorResponseDto,
      }),
    );
  }

  // 서버 에러 (500)
  decorators.push(
    ApiResponse({
      status: 500,
      description: '서버 내부 에러',
      type: ErrorResponseDto,
    }),
  );

  return applyDecorators(...decorators);
}

/**
 * 생성(Create) API 응답 데코레이터
 *
 * 201 Created 응답과 공통 에러 응답을 추가합니다
 */
export function ApiCreateResponses(
  successType?: Type<any> | Function | [Function] | string,
  successDescription: string = '리소스가 성공적으로 생성되었습니다',
) {
  return ApiStandardResponses(201, successType, successDescription);
}

/**
 * 조회(Get) API 응답 데코레이터
 *
 * 200 OK 응답과 공통 에러 응답을 추가합니다
 */
export function ApiGetResponses(
  successType?: Type<any> | Function | [Function] | string,
  successDescription: string = '요청이 성공적으로 처리되었습니다',
) {
  return ApiStandardResponses(200, successType, successDescription);
}

/**
 * 수정(Update) API 응답 데코레이터
 *
 * 200 OK 응답과 공통 에러 응답을 추가합니다
 */
export function ApiUpdateResponses(
  successType?: Type<any> | Function | [Function] | string,
  successDescription: string = '리소스가 성공적으로 수정되었습니다',
) {
  return ApiStandardResponses(200, successType, successDescription);
}

/**
 * 삭제(Delete) API 응답 데코레이터
 *
 * 204 No Content 응답과 공통 에러 응답을 추가합니다
 */
export function ApiDeleteResponses(successDescription: string = '리소스가 성공적으로 삭제되었습니다') {
  return applyDecorators(
    ApiResponse({
      status: 204,
      description: successDescription,
    }),
    ApiResponse({
      status: 401,
      description: '인증 실패',
      type: UnauthorizedErrorResponseDto,
    }),
    ApiResponse({
      status: 403,
      description: '권한 부족',
      type: ForbiddenErrorResponseDto,
    }),
    ApiResponse({
      status: 404,
      description: '리소스를 찾을 수 없음',
      type: ErrorResponseDto,
    }),
    ApiResponse({
      status: 429,
      description: 'Rate Limit 초과',
      type: RateLimitErrorResponseDto,
    }),
    ApiResponse({
      status: 500,
      description: '서버 내부 에러',
      type: ErrorResponseDto,
    }),
  );
}

/**
 * 인증 불필요 API 응답 데코레이터
 *
 * 인증/권한 에러 응답을 제외한 표준 응답을 추가합니다
 */
export function ApiPublicResponses(
  successStatus: number = 200,
  successType?: Type<any> | Function | [Function] | string,
  successDescription: string = '요청이 성공적으로 처리되었습니다',
) {
  return ApiStandardResponses(successStatus, successType, successDescription, {
    includeAuth: false,
  });
}
