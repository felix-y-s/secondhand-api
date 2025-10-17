/**
 * 페이지네이션 옵션 인터페이스
 */
export interface PaginationOptions {
  /** 현재 페이지 번호 (1부터 시작) */
  page: number;
  /** 페이지당 항목 수 */
  limit: number;
  /** 정렬 필드 (선택사항) */
  sortBy?: string;
  /** 정렬 순서 (선택사항) */
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * 페이지네이션 메타데이터 인터페이스
 */
export interface PaginationMeta {
  /** 전체 항목 수 */
  total: number;
  /** 현재 페이지 번호 */
  page: number;
  /** 페이지당 항목 수 */
  limit: number;
  /** 전체 페이지 수 */
  totalPages: number;
  /** 다음 페이지 존재 여부 */
  hasNextPage: boolean;
  /** 이전 페이지 존재 여부 */
  hasPreviousPage: boolean;
  /** 다음 페이지 번호 (없으면 null) */
  nextPage: number | null;
  /** 이전 페이지 번호 (없으면 null) */
  previousPage: number | null;
}

/**
 * 페이지네이션 결과 인터페이스
 */
export interface PaginatedResult<T> {
  /** 데이터 배열 */
  data: T[];
  /** 페이지네이션 메타데이터 */
  meta: PaginationMeta;
}

/**
 * 커서 기반 페이지네이션 옵션
 */
export interface CursorPaginationOptions {
  /** 커서 (마지막 항목의 ID 또는 타임스탬프) */
  cursor?: string | number;
  /** 페이지당 항목 수 */
  limit: number;
  /** 정렬 순서 */
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * 커서 기반 페이지네이션 결과
 */
export interface CursorPaginatedResult<T> {
  /** 데이터 배열 */
  data: T[];
  /** 다음 커서 (없으면 null) */
  nextCursor: string | number | null;
  /** 다음 페이지 존재 여부 */
  hasNextPage: boolean;
}

/**
 * 페이지네이션 유틸리티 클래스
 *
 * 오프셋 기반 및 커서 기반 페이지네이션 기능 제공
 * - 페이지네이션 메타데이터 생성
 * - Skip/Take 계산
 * - 커서 기반 페이지네이션 지원
 */
export class PaginationUtil {
  /**
   * 페이지네이션 적용
   *
   * @param data - 데이터 배열
   * @param total - 전체 항목 수
   * @param options - 페이지네이션 옵션
   * @returns 페이지네이션 결과
   *
   * @example
   * const result = PaginationUtil.paginate(users, 100, { page: 2, limit: 10 });
   * // {
   * //   data: [...],
   * //   meta: { total: 100, page: 2, limit: 10, ... }
   * // }
   */
  static paginate<T>(data: T[], total: number, options: PaginationOptions): PaginatedResult<T> {
    const { page, limit } = options;
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        nextPage: page < totalPages ? page + 1 : null,
        previousPage: page > 1 ? page - 1 : null,
      },
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
   * @param options - 페이지네이션 옵션
   * @returns Prisma 쿼리 옵션
   *
   * @example
   * const prismaOptions = PaginationUtil.getPrismaOptions({ page: 2, limit: 10 });
   * // { skip: 10, take: 10 }
   *
   * await prisma.user.findMany(prismaOptions);
   */
  static getPrismaOptions(options: PaginationOptions): {
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
   * @param options - 페이지네이션 옵션
   * @returns MongoDB 쿼리 옵션
   *
   * @example
   * const mongoOptions = PaginationUtil.getMongoOptions({ page: 2, limit: 10 });
   * // { skip: 10, limit: 10 }
   *
   * await collection.find().skip(10).limit(10);
   */
  static getMongoOptions(options: PaginationOptions): {
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
   * //   data: [...10 items],
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
    const nextCursor = hasNextPage && paginatedData.length > 0 ? getCursor(paginatedData[paginatedData.length - 1]) : null;

    return {
      data: paginatedData,
      nextCursor,
      hasNextPage,
    };
  }

  /**
   * 페이지네이션 옵션 검증 및 정규화
   *
   * @param page - 페이지 번호
   * @param limit - 페이지당 항목 수
   * @param maxLimit - 최대 limit 값 (기본값: 100)
   * @returns 정규화된 페이지네이션 옵션
   *
   * @example
   * const options = PaginationUtil.normalizeOptions(0, 200);
   * // { page: 1, limit: 100 } (음수 페이지는 1로, 초과 limit는 maxLimit로)
   */
  static normalizeOptions(
    page: number,
    limit: number,
    maxLimit: number = 100,
  ): {
    page: number;
    limit: number;
  } {
    const normalizedPage = page && page > 0 ? page : 1;
    const normalizedLimit = limit && limit > 0 ? limit : 10;

    return {
      page: Math.max(1, normalizedPage),
      limit: Math.min(normalizedLimit, maxLimit),
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
   * @param options - 페이지네이션 옵션
   * @returns 빈 페이지네이션 결과
   */
  static createEmptyResult<T>(options: PaginationOptions): PaginatedResult<T> {
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
  static getPageRange(currentPage: number, totalPages: number, delta: number = 2): (number | string)[] {
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
