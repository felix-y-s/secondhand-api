import { CursorPaginatedResult, CursorPaginationOptions, PaginatedResult, PaginationOptions, PaginationMeta } from '../types';

/**
 * 페이지네이션 유틸리티 클래스
 *
 * 오프셋 기반 및 커서 기반 페이지네이션 기능 제공
 * - 페이지네이션 메타데이터 생성
 * - Skip/Take 계산
 * - 커서 기반 페이지네이션 지원
 * @description
 * 사용 패턴
 * ```ts
 * // Controller: optional 필드로 받음
 * async getMessages(@Query() query: PaginationDto) {
 *   // query implements PaginationOptions
 * }
 * 
 * // Service: PaginationUtil.normalize()로 Required로 변환
 * async findMessages(options: PaginationOptions) {
 *   const normalized = PaginationUtil.normalize(options);
 *   // normalized: Required<PaginationOptions>
 * }
 * 
 * // Repository: Required 타입으로 받음
 * async find(options: Required<PaginationOptions>) {
 *   // 모든 필드가 보장됨
 * }
 * ```
 */
export class PaginationUtil {
  /**
   * 페이지네이션 메타데이터 생성
   *
   * @param total - 전체 항목 수
   * @param options - 페이지네이션 옵션 (page, limit 필수)
   * @returns 페이지네이션 메타데이터
   *
   * @example
   * const meta = PaginationUtil.createMeta(100, { page: 2, limit: 10 });
   * // { total: 100, page: 2, limit: 10, totalPages: 10, hasNextPage: true, ... }
   */
  static createMeta(
    total: number,
    options: Required<Pick<PaginationOptions, 'page' | 'limit'>>,
  ): PaginationMeta {
    const { page, limit } = options;
    const totalPages = Math.ceil(total / limit);

    return {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      nextPage: page < totalPages ? page + 1 : null,
      previousPage: page > 1 ? page - 1 : null,
    };
  }

  /**
   * 페이지네이션 결과 생성 (items + meta)
   *
   * @param items - 데이터 배열
   * @param total - 전체 항목 수
   * @param options - 페이지네이션 옵션 (page, limit 필수)
   * @returns 페이지네이션 결과 { items, meta }
   *
   * @example
   * const result = PaginationUtil.paginate(users, 100, { page: 2, limit: 10 });
   * // { items: [...], meta: { total: 100, page: 2, limit: 10, ... } }
   */
  static paginate<T>(
    items: T[],
    total: number,
    options: Required<Pick<PaginationOptions, 'page' | 'limit'>>,
  ): PaginatedResult<T> {
    return {
      items,
      meta: this.createMeta(total, options),
    };
  }

  /**
   * Skip 값 계산 (데이터베이스 쿼리용)
   *
   * @param page - 페이지 번호 (1부터 시작)
   * @param limit - 페이지당 항목 수
   * @returns Skip 값
   *
   * @example
   * const skip = PaginationUtil.getSkip(2, 10);
   * // 10 (2페이지는 첫 10개를 건너뜀)
   */
  static getSkip(page: number, limit: number): number {
    return (page - 1) * limit;
  }

  /**
   * Take 값 반환 (페이지당 항목 수와 동일)
   *
   * @param limit - 페이지당 항목 수
   * @returns Take 값
   */
  static getTake(limit: number): number {
    return limit;
  }

  /**
   * Prisma용 페이지네이션 옵션 생성
   *
   * @param options - 페이지네이션 옵션 (page, limit 필수)
   * @returns Prisma 쿼리 옵션
   *
   * @example
   * const prismaOptions = PaginationUtil.getPrismaOptions({ page: 2, limit: 10 });
   * // { skip: 10, take: 10 }
   *
   * await prisma.user.findMany(prismaOptions);
   */
  static getPrismaOptions(options: Required<Pick<PaginationOptions, 'page' | 'limit'>> & Pick<PaginationOptions, 'sortBy' | 'sortOrder'>): {
    skip: number;
    take: number;
    orderBy?: Record<string, 'asc' | 'desc'>;
  } {
    const { page, limit, sortBy, sortOrder } = options;

    const result: any = {
      skip: this.getSkip(page, limit),
      take: this.getTake(limit),
    };

    if (sortBy) {
      result.orderBy = {
        [sortBy]: sortOrder?.toLowerCase() || 'asc',
      };
    }

    return result;
  }

  /**
   * MongoDB용 페이지네이션 옵션 생성
   *
   * @param options - 페이지네이션 옵션 (page, limit 필수)
   * @returns MongoDB 쿼리 옵션
   *
   * @example
   * const mongoOptions = PaginationUtil.getMongoOptions({ page: 2, limit: 10 });
   * // { skip: 10, limit: 10 }
   *
   * await collection.find().skip(10).limit(10);
   */
  static getMongoOptions(options: Required<Pick<PaginationOptions, 'page' | 'limit'>> & Pick<PaginationOptions, 'sortBy' | 'sortOrder'>): {
    skip: number;
    limit: number;
    sort?: Record<string, 1 | -1>;
  } {
    const { page, limit, sortBy, sortOrder } = options;

    const result: any = {
      skip: this.getSkip(page, limit),
      limit: this.getTake(limit),
    };

    if (sortBy) {
      result.sort = {
        [sortBy]: sortOrder === 'DESC' ? -1 : 1,
      };
    }

    return result;
  }

  /**
   * 커서 기반 페이지네이션 적용
   *
   * @param data - 데이터 배열 (limit + 1 개를 조회해야 함)
   * @param options - 커서 페이지네이션 옵션
   * @param getCursor - 커서 추출 함수
   * @returns 커서 페이지네이션 결과
   *
   * @example
   * // DB에서 limit + 1 개 조회
   * const items = await db.find({ id: { gt: cursor } }).limit(11);
   *
   * const result = PaginationUtil.cursorPaginate(
   *   items,
   *   { cursor: '123', limit: 10 },
   *   (item) => item.id
   * );
   * // {
   * //   items: [...10 items],
   * //   nextCursor: '133',
   * //   hasNextPage: true
   * // }
   */
  static cursorPaginate<T>(
    data: T[],
    options: CursorPaginationOptions,
    getCursor: (item: T) => string | number,
  ): CursorPaginatedResult<T> {
    const { limit } = options;
    const hasNextPage = data.length > limit;

    // 실제 반환할 데이터는 limit 개수만큼만
    const paginatedData = hasNextPage ? data.slice(0, limit) : data;

    // 다음 커서는 마지막 항목의 커서값
    const nextCursor =
      hasNextPage && paginatedData.length > 0
        ? getCursor(paginatedData[paginatedData.length - 1])
        : null;

    return {
      items: paginatedData,
      nextCursor,
      hasNextPage,
    };
  }

  /**
   * 총 페이지 수 계산
   *
   * @param total - 전체 항목 수
   * @param limit - 페이지당 항목 수
   * @returns 총 페이지 수
   */
  static getTotalPages(total: number, limit: number): number {
    return Math.ceil(total / limit);
  }

  /**
   * 페이지가 유효한 범위 내에 있는지 확인
   *
   * @param page - 페이지 번호
   * @param total - 전체 항목 수
   * @param limit - 페이지당 항목 수
   * @returns 유효성 여부
   */
  static isValidPage(page: number, total: number, limit: number): boolean {
    const totalPages = this.getTotalPages(total, limit);
    return page >= 1 && page <= totalPages;
  }

  /**
   * 빈 페이지네이션 결과 생성
   *
   * @param options - 페이지네이션 옵션 (page, limit 필수)
   * @returns 빈 페이지네이션 결과
   */
  static createEmptyResult<T>(options: Required<Pick<PaginationOptions, 'page' | 'limit'>>): PaginatedResult<T> {
    return this.paginate([], 0, options);
  }

  /**
   * 페이지 범위 계산 (페이지네이션 UI용)
   *
   * @param currentPage - 현재 페이지
   * @param totalPages - 전체 페이지 수
   * @param delta - 현재 페이지 앞뒤로 표시할 페이지 수 (기본값: 2)
   * @returns 표시할 페이지 번호 배열
   *
   * @example
   * const pageRange = PaginationUtil.getPageRange(5, 10, 2);
   * // [1, '...', 3, 4, 5, 6, 7, '...', 10]
   */
  static getPageRange(
    currentPage: number,
    totalPages: number,
    delta: number = 2,
  ): (number | string)[] {
    const range: (number | string)[] = [];
    const left = Math.max(2, currentPage - delta);
    const right = Math.min(totalPages - 1, currentPage + delta);

    // 첫 페이지는 항상 표시
    range.push(1);

    // 왼쪽 생략 표시
    if (left > 2) {
      range.push('...');
    }

    // 중간 페이지들
    for (let i = left; i <= right; i++) {
      range.push(i);
    }

    // 오른쪽 생략 표시
    if (right < totalPages - 1) {
      range.push('...');
    }

    // 마지막 페이지는 항상 표시 (totalPages > 1인 경우)
    if (totalPages > 1) {
      range.push(totalPages);
    }

    return range;
  }
}
