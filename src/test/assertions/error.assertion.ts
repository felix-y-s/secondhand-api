import { ErrorResponseDto, ValidationErrorResponseDto } from '@/common/dto/error-response.dto';
import { expectValidTimestamp } from './response.assertion';

/**
 * 401 Unauthorized 에러 검증
 *
 * HttpExceptionFilter 형식만 지원: { success, statusCode, error: { message, details }, timestamp }
 * 다른 형식으로 응답하는 경우 테스트 실패로 처리
 */
export function expectUnauthorizedError(
  body: any,
  expectedMessage?: string,
) {
  expect(body).toMatchObject({
    success: false,
    statusCode: 401,
    error: {
      message: expect.any(String),
    },
    timestamp: expect.any(String),
  });

  if (expectedMessage) {
    expect(body.error.message).toContain(expectedMessage);
  }

  expectValidTimestamp(body.timestamp);
}

/**
 * 400 Bad Request 에러 검증
 *
 * HttpExceptionFilter 형식만 지원: { success, statusCode, error: { message, details }, timestamp }
 * 다른 형식으로 응답하는 경우 테스트 실패로 처리
 *
 * @param body - 응답 본문
 * @param expectedMessage - 기대되는 메시지 (선택, 부분 일치 검사)
 */
export function expectBadRequestError(
  body: any,
  expectedMessage?: string,
) {
  expect(body).toMatchObject({
    success: false,
    statusCode: 400,
    error: {
      message: expect.any(String),
    },
    timestamp: expect.any(String),
  });

  if (expectedMessage) {
    expect(body.error.message).toContain(expectedMessage);
  }

  expectValidTimestamp(body.timestamp);
}