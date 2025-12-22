/**
 * 페이지네이션 응답 검증 헬퍼
 *
 * PaginatedResult 표준 형식 강제
 */

/**
 * 페이지네이션 메타데이터 검증 옵션
 */
export interface PaginationMetaValidation {
  /** 기대하는 페이지 번호 */
  page?: number;
  /** 기대하는 페이지 크기 */
  limit?: number;
  /** 기대하는 전체 아이템 개수 */
  total?: number;
  /** 기대하는 전체 페이지 수 */
  totalPages?: number;
}

/**
 * PaginatedResult 형식 검증
 *
 * 페이지네이션 응답의 표준 구조를 검증합니다:
 * - items: 데이터 배열
 * - meta: 페이지네이션 메타데이터 (page, limit, total, totalPages)
 *
 * @template T - 아이템 타입
 * @param {any} data - 검증할 페이지네이션 결과 객체
 * @param {number} [expectedCount] - 기대하는 아이템 개수 (선택). 지정 시 items 배열 길이를 검증
 * @param {(item: T) => void} [itemValidator] - 각 아이템을 검증하는 함수 (선택). 모든 아이템에 대해 실행
 * @param {PaginationMetaValidation} [metaValidation] - 메타데이터 값 검증 (선택)
 *
 * @example
 * // 구조만 검증
 * expectPaginatedResult(response.data);
 *
 * @example
 * // 아이템 개수만 검증
 * expectPaginatedResult(response.data, 5);
 *
 * @example
 * // 아이템 개수 + 각 아이템 검증
 * expectPaginatedResult(response.data, 5, (message) => {
 *   expect(message).toHaveProperty('id');
 *   expect(message).toHaveProperty('content');
 * });
 *
 * @example
 * // 아이템 검증만 (개수는 검증 안 함)
 * expectPaginatedResult(response.data, undefined, validateMessage);
 *
 * @example
 * // 메타데이터 값까지 검증
 * expectPaginatedResult(response.data, 10, validateMessage, {
 *   page: 1,
 *   limit: 10,
 *   total: 25,
 *   totalPages: 3
 * });
 *
 * @example
 * // E2E 테스트: API 계약 검증
 * const res = await request(app).get('/messages?page=2&limit=10');
 * expectPaginatedResult(res.body.data, 10, validateItem, {
 *   page: 2,    // 요청한 페이지가 응답에 반영되었는지 검증
 *   limit: 10,  // 요청한 limit이 응답에 반영되었는지 검증
 * });
 */
export function expectPaginatedResult<T>(
  data: any,
  expectedCount?: number,
  itemValidator?: (item: T) => void,
  metaValidation?: PaginationMetaValidation,
) {
  // 1. 기본 구조 검증
  expect(data).toHaveProperty('items');
  expect(data).toHaveProperty('meta');
  expect(Array.isArray(data.items)).toBe(true);

  // 2. 아이템 개수 검증 (선택)
  if (expectedCount !== undefined) {
    expect(data.items).toHaveLength(expectedCount);
  }

  // 3. meta 필드 존재 검증
  expect(data.meta).toHaveProperty('page');
  expect(data.meta).toHaveProperty('limit');
  expect(data.meta).toHaveProperty('total');
  expect(data.meta).toHaveProperty('totalPages');

  // 4. meta 값 검증 (선택)
  if (metaValidation) {
    if (metaValidation.page !== undefined) {
      expect(data.meta.page).toBe(metaValidation.page);
    }
    if (metaValidation.limit !== undefined) {
      expect(data.meta.limit).toBe(metaValidation.limit);
    }
    if (metaValidation.total !== undefined) {
      expect(data.meta.total).toBe(metaValidation.total);
    }
    if (metaValidation.totalPages !== undefined) {
      expect(data.meta.totalPages).toBe(metaValidation.totalPages);
    }
  }

  // 5. 각 아이템 검증 (선택)
  if (itemValidator && data.items.length > 0) {
    data.items.forEach(itemValidator);
  }
}
