/**
 * 페이지네이션 응답 검증 헬퍼
 *
 * PaginatedResult 표준 형식 강제
 */

/**
 * PaginatedResult 형식 검증
 *
 * @param result - 페이지네이션 결과 객체
 * @param itemValidator - 각 아이템 검증 함수 (선택)
 */
export function expectPaginatedResult<T>(
  result: any,
  itemValidator?: (item: T) => void,
) {
  expect(result).toHaveProperty('items');
  expect(result).toHaveProperty('meta');

  expect(Array.isArray(result.items)).toBe(true);

  expect(result.meta).toHaveProperty('page');
  expect(result.meta).toHaveProperty('limit');
  expect(result.meta).toHaveProperty('total');
  expect(result.meta).toHaveProperty('totalPages');

  // 각 아이템 검증 (선택 사항)
  if (itemValidator && result.items.length > 0) {
    result.items.forEach(itemValidator);
  }
}
