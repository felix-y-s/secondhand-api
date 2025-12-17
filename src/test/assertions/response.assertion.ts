/**
 * 성공 응답 검증 헬퍼
 *
 * @param body - 응답 본문
 * @param assertData - data 필드 검증 함수 (선택)
 * @param expectedStatusCode - 기대되는 상태 코드 (기본: 200)
 */
export function expectSuccessResponse<T>(
  body: any,
  assertData?: (data: T) => void,
  expectedStatusCode = 200,
) {
  expect(body).toMatchObject({
    success: true,
    statusCode: expectedStatusCode,
    timestamp: expect.any(String),
  });

  expectValidTimestamp(body.timestamp);

  if (assertData && body.data) {
    assertData(body.data);
  }
}

/**
 * 201 Created 응답 검증 헬퍼
 */
export function expectCreatedResponse<T>(
  body: any,
  assertData?: (data: T) => void,
) {
  expectSuccessResponse(body, assertData, 201);
}

/**
 * 204 No Content 응답 검증 헬퍼
 */
export function expectNoContentResponse(body: any) {
  expect(body).toMatchObject({
    success: true,
    statusCode: 204,
  });
}

/**
 * 타임스탬프 유효성 검증
 */
export function expectValidTimestamp(timestamp: string) {
  expect(timestamp).toBeDefined();
  expect(new Date(timestamp).toString()).not.toBe('Invalid Date');
}

/**
 * 일반 응답 검증 (상태 코드만 확인하고 나머지는 유연하게)
 *
 * @deprecated expectSuccessResponse 사용 권장
 */
export function expectResponse(body: any, expectedStatusCode = 200) {
  expect(body.success).toBe(true);
  expect(body.statusCode).toBe(expectedStatusCode);
  expect(body).toHaveProperty('data');
  expectValidTimestamp(body.timestamp);
}
