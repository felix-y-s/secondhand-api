import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import {
  PaginationDto,
  CursorPaginationDto,
  ResponseDto,
  PaginatedResponseDto,
  CursorPaginatedResponseDto,
  IdResponseDto,
  SuccessResponseDto,
  UuidParamDto,
  IntIdParamDto,
  StringIdParamDto,
  SearchDto,
  DateRangeSearchDto,
} from '../src/common/dto';

describe('Common DTO Validation', () => {
  describe('PaginationDto', () => {
    it('유효한 페이지네이션 파라미터를 허용해야 함', async () => {
      const dto = plainToClass(PaginationDto, {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('기본값을 올바르게 적용해야 함', () => {
      const dto = new PaginationDto();
      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(10);
      expect(dto.sortOrder).toBe('DESC');
    });

    it('페이지 번호가 1 미만이면 에러를 반환해야 함', async () => {
      const dto = plainToClass(PaginationDto, { page: 0 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('page');
    });

    it('limit가 100을 초과하면 에러를 반환해야 함', async () => {
      const dto = plainToClass(PaginationDto, { limit: 101 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('limit');
    });

    it('sortOrder가 ASC 또는 DESC가 아니면 에러를 반환해야 함', async () => {
      const dto = plainToClass(PaginationDto, { sortOrder: 'INVALID' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('sortOrder');
    });
  });

  describe('CursorPaginationDto', () => {
    it('유효한 커서 페이지네이션 파라미터를 허용해야 함', async () => {
      const dto = plainToClass(CursorPaginationDto, {
        cursor: '123',
        limit: 20,
        sortOrder: 'DESC',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('기본값을 올바르게 적용해야 함', () => {
      const dto = new CursorPaginationDto();
      expect(dto.limit).toBe(20);
      expect(dto.sortOrder).toBe('DESC');
    });

    it('limit가 100을 초과하면 에러를 반환해야 함', async () => {
      const dto = plainToClass(CursorPaginationDto, { limit: 101 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('ResponseDto', () => {
    it('성공 응답을 생성해야 함', () => {
      const data = { id: 1, name: 'Test' };
      const response = ResponseDto.success(data, '성공');

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.message).toBe('성공');
      expect(response.timestamp).toBeDefined();
    });

    it('실패 응답을 생성해야 함', () => {
      const error = { code: 'ERR001', message: '에러 발생' };
      const response = ResponseDto.error(error, '실패');

      expect(response.success).toBe(false);
      expect(response.error).toEqual(error);
      expect(response.message).toBe('실패');
      expect(response.timestamp).toBeDefined();
    });
  });

  describe('PaginatedResponseDto', () => {
    it('페이지네이션 응답을 생성해야 함', () => {
      const data = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ];
      const meta = {
        total: 100,
        page: 1,
        limit: 10,
        totalPages: 10,
        hasNextPage: true,
        hasPreviousPage: false,
        nextPage: 2,
        previousPage: null,
      };

      const response = PaginatedResponseDto.create(data, meta, '조회 성공');

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.meta).toEqual(meta);
      expect(response.message).toBe('조회 성공');
    });
  });

  describe('CursorPaginatedResponseDto', () => {
    it('커서 페이지네이션 응답을 생성해야 함', () => {
      const data = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ];

      const response = CursorPaginatedResponseDto.create(data, '123', true, '조회 성공');

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.nextCursor).toBe('123');
      expect(response.hasNextPage).toBe(true);
    });

    it('마지막 페이지에서는 nextCursor가 null이어야 함', () => {
      const data = [{ id: 1, name: 'Item 1' }];

      const response = CursorPaginatedResponseDto.create(data, null, false);

      expect(response.nextCursor).toBeNull();
      expect(response.hasNextPage).toBe(false);
    });
  });

  describe('IdResponseDto', () => {
    it('ID 응답을 생성해야 함', () => {
      const response = new IdResponseDto('123');
      expect(response.id).toBe('123');
    });

    it('숫자 ID도 허용해야 함', () => {
      const response = new IdResponseDto(123);
      expect(response.id).toBe(123);
    });
  });

  describe('SuccessResponseDto', () => {
    it('성공 응답을 생성해야 함', () => {
      const response = new SuccessResponseDto('작업 완료');
      expect(response.success).toBe(true);
      expect(response.message).toBe('작업 완료');
    });

    it('메시지 없이도 생성 가능해야 함', () => {
      const response = new SuccessResponseDto();
      expect(response.success).toBe(true);
      expect(response.message).toBeUndefined();
    });
  });

  describe('UuidParamDto', () => {
    it('유효한 UUID를 허용해야 함', async () => {
      const dto = plainToClass(UuidParamDto, {
        id: '123e4567-e89b-12d3-a456-426614174000',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('잘못된 UUID 형식은 에러를 반환해야 함', async () => {
      const dto = plainToClass(UuidParamDto, { id: 'invalid-uuid' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('id');
    });
  });

  describe('IntIdParamDto', () => {
    it('유효한 정수 ID를 허용해야 함', async () => {
      const dto = plainToClass(IntIdParamDto, { id: 123 });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('정수가 아닌 값은 에러를 반환해야 함', async () => {
      const dto = plainToClass(IntIdParamDto, { id: '123abc' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('StringIdParamDto', () => {
    it('유효한 문자열 ID를 허용해야 함', async () => {
      const dto = plainToClass(StringIdParamDto, { id: '507f1f77bcf86cd799439011' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('빈 문자열은 에러를 반환해야 함', async () => {
      const dto = plainToClass(StringIdParamDto, { id: '' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('id');
    });
  });

  describe('SearchDto', () => {
    it('유효한 검색 파라미터를 허용해야 함', async () => {
      const dto = plainToClass(SearchDto, {
        keyword: '아이폰',
        searchFields: 'title,description',
        page: 1,
        limit: 10,
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('검색 키워드가 100자를 초과하면 에러를 반환해야 함', async () => {
      const dto = plainToClass(SearchDto, { keyword: 'a'.repeat(101) });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('keyword');
    });

    it('PaginationDto를 상속받아 페이지네이션 기능을 제공해야 함', () => {
      const dto = new SearchDto();
      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(10);
    });
  });

  describe('DateRangeSearchDto', () => {
    it('유효한 날짜 범위 검색 파라미터를 허용해야 함', async () => {
      const dto = plainToClass(DateRangeSearchDto, {
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-12-31T23:59:59Z',
        keyword: '검색어',
        page: 1,
        limit: 10,
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('SearchDto를 상속받아 검색 기능을 제공해야 함', () => {
      const dto = new DateRangeSearchDto();
      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(10);
    });
  });
});
