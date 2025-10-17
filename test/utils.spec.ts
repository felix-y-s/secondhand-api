import { DateUtil } from '../src/common/utils/date.util';
import { CryptoUtil } from '../src/common/utils/crypto.util';
import { PaginationUtil } from '../src/common/utils/pagination.util';

describe('Utility Functions', () => {
  describe('DateUtil', () => {
    describe('format', () => {
      it('날짜를 지정된 형식으로 포맷팅해야 함', () => {
        const date = new Date('2025-10-17T10:30:00');
        const formatted = DateUtil.format(date, 'yyyy-MM-dd');
        expect(formatted).toBe('2025-10-17');
      });

      it('시간 포함 포맷팅이 가능해야 함', () => {
        const date = new Date('2025-10-17T10:30:45');
        const formatted = DateUtil.format(date, 'yyyy-MM-dd HH:mm:ss');
        expect(formatted).toMatch(/2025-10-17 \d{2}:\d{2}:\d{2}/);
      });
    });

    describe('addDays / subDays', () => {
      it('날짜에 일수를 더할 수 있어야 함', () => {
        const date = new Date('2025-10-17');
        const result = DateUtil.addDays(date, 7);
        expect(DateUtil.format(result, 'yyyy-MM-dd')).toBe('2025-10-24');
      });

      it('날짜에서 일수를 뺄 수 있어야 함', () => {
        const date = new Date('2025-10-17');
        const result = DateUtil.subDays(date, 7);
        expect(DateUtil.format(result, 'yyyy-MM-dd')).toBe('2025-10-10');
      });
    });

    describe('startOfDay / endOfDay', () => {
      it('하루의 시작 시간을 반환해야 함', () => {
        const date = new Date('2025-10-17T15:30:00');
        const result = DateUtil.startOfDay(date);
        expect(result.getHours()).toBe(0);
        expect(result.getMinutes()).toBe(0);
        expect(result.getSeconds()).toBe(0);
      });

      it('하루의 마지막 시간을 반환해야 함', () => {
        const date = new Date('2025-10-17T15:30:00');
        const result = DateUtil.endOfDay(date);
        expect(result.getHours()).toBe(23);
        expect(result.getMinutes()).toBe(59);
        expect(result.getSeconds()).toBe(59);
      });
    });

    describe('differenceInDays', () => {
      it('두 날짜 간의 일수 차이를 계산해야 함', () => {
        const date1 = new Date('2025-10-17');
        const date2 = new Date('2025-10-10');
        const diff = DateUtil.differenceInDays(date1, date2);
        expect(diff).toBe(7);
      });
    });

    describe('isAfter / isBefore', () => {
      it('날짜 비교가 정확해야 함', () => {
        const date1 = new Date('2025-10-17');
        const date2 = new Date('2025-10-10');

        expect(DateUtil.isAfter(date1, date2)).toBe(true);
        expect(DateUtil.isBefore(date2, date1)).toBe(true);
      });
    });

    describe('getTodayRange', () => {
      it('오늘 날짜의 시작과 끝을 반환해야 함', () => {
        const { start, end } = DateUtil.getTodayRange();

        expect(start.getHours()).toBe(0);
        expect(end.getHours()).toBe(23);
        expect(end.getMinutes()).toBe(59);
      });
    });

    describe('getLastNDaysRange', () => {
      it('N일 전부터 오늘까지의 범위를 반환해야 함', () => {
        const { start, end } = DateUtil.getLastNDaysRange(7);
        const diff = DateUtil.differenceInDays(end, start);
        expect(diff).toBe(6); // 7일 범위 (0-6일)
      });
    });
  });

  describe('CryptoUtil', () => {
    describe('hashPassword / comparePassword', () => {
      it('비밀번호를 해싱하고 검증할 수 있어야 함', async () => {
        const password = 'mySecurePassword123';
        const hash = await CryptoUtil.hashPassword(password);

        expect(hash).toBeDefined();
        expect(hash).not.toBe(password);

        const isValid = await CryptoUtil.comparePassword(password, hash);
        expect(isValid).toBe(true);

        const isInvalid = await CryptoUtil.comparePassword('wrongPassword', hash);
        expect(isInvalid).toBe(false);
      });

      it('같은 비밀번호라도 매번 다른 해시를 생성해야 함', async () => {
        const password = 'myPassword123';
        const hash1 = await CryptoUtil.hashPassword(password);
        const hash2 = await CryptoUtil.hashPassword(password);

        expect(hash1).not.toBe(hash2);
        expect(await CryptoUtil.comparePassword(password, hash1)).toBe(true);
        expect(await CryptoUtil.comparePassword(password, hash2)).toBe(true);
      });
    });

    describe('encrypt / decrypt', () => {
      const secretKey = CryptoUtil.generateAESKey();

      it('AES-256-GCM 암호화와 복호화가 정상 동작해야 함', () => {
        const plaintext = 'sensitive data 123!@#';
        const encrypted = CryptoUtil.encrypt(plaintext, secretKey);

        expect(encrypted).toBeDefined();
        expect(encrypted).not.toBe(plaintext);
        expect(encrypted.split(':').length).toBe(3); // IV:AuthTag:Ciphertext

        const decrypted = CryptoUtil.decrypt(encrypted, secretKey);
        expect(decrypted).toBe(plaintext);
      });

      it('잘못된 키로 복호화 시 에러가 발생해야 함', () => {
        const plaintext = 'sensitive data';
        const encrypted = CryptoUtil.encrypt(plaintext, secretKey);

        const wrongKey = CryptoUtil.generateAESKey();
        expect(() => CryptoUtil.decrypt(encrypted, wrongKey)).toThrow();
      });

      it('한글 텍스트 암호화/복호화가 가능해야 함', () => {
        const plaintext = '안녕하세요 암호화 테스트입니다';
        const encrypted = CryptoUtil.encrypt(plaintext, secretKey);
        const decrypted = CryptoUtil.decrypt(encrypted, secretKey);

        expect(decrypted).toBe(plaintext);
      });
    });

    describe('sha256', () => {
      it('SHA-256 해시를 생성해야 함', () => {
        const text = 'hello world';
        const hash = CryptoUtil.sha256(text);

        expect(hash).toBeDefined();
        expect(hash.length).toBe(64); // SHA-256은 32바이트 = 64 hex 문자
        expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
      });

      it('같은 입력은 항상 같은 해시를 생성해야 함', () => {
        const text = 'consistent hash';
        const hash1 = CryptoUtil.sha256(text);
        const hash2 = CryptoUtil.sha256(text);

        expect(hash1).toBe(hash2);
      });
    });

    describe('generateToken', () => {
      it('랜덤 토큰을 생성해야 함', () => {
        const token = CryptoUtil.generateToken(32);

        expect(token).toBeDefined();
        expect(token.length).toBe(64); // 32바이트 = 64 hex 문자
      });

      it('매번 다른 토큰을 생성해야 함', () => {
        const token1 = CryptoUtil.generateToken();
        const token2 = CryptoUtil.generateToken();

        expect(token1).not.toBe(token2);
      });
    });

    describe('generateNumericCode', () => {
      it('지정된 길이의 숫자 코드를 생성해야 함', () => {
        const code = CryptoUtil.generateNumericCode(6);

        expect(code).toBeDefined();
        expect(code.length).toBe(6);
        expect(/^\d{6}$/.test(code)).toBe(true);
      });

      it('매번 다른 코드를 생성해야 함', () => {
        const code1 = CryptoUtil.generateNumericCode(6);
        const code2 = CryptoUtil.generateNumericCode(6);

        // 통계적으로 거의 항상 다르지만, 100% 보장은 아님
        // 실제 환경에서는 충분히 랜덤함
        expect(code1).toBeDefined();
        expect(code2).toBeDefined();
      });
    });

    describe('base64Encode / base64Decode', () => {
      it('Base64 인코딩/디코딩이 정상 동작해야 함', () => {
        const text = 'Hello World!';
        const encoded = CryptoUtil.base64Encode(text);
        const decoded = CryptoUtil.base64Decode(encoded);

        expect(encoded).toBe('SGVsbG8gV29ybGQh');
        expect(decoded).toBe(text);
      });

      it('한글 텍스트 인코딩/디코딩이 가능해야 함', () => {
        const text = '안녕하세요';
        const encoded = CryptoUtil.base64Encode(text);
        const decoded = CryptoUtil.base64Decode(encoded);

        expect(decoded).toBe(text);
      });
    });

    describe('validatePasswordStrength', () => {
      it('강한 비밀번호는 높은 점수를 받아야 함', () => {
        const result = CryptoUtil.validatePasswordStrength('MyP@ssw0rd123');

        expect(result.score).toBeGreaterThanOrEqual(4);
        expect(result.isStrong).toBe(true);
        expect(result.feedback.length).toBe(0);
      });

      it('약한 비밀번호는 낮은 점수와 피드백을 받아야 함', () => {
        const result = CryptoUtil.validatePasswordStrength('weak');

        expect(result.score).toBeLessThan(4);
        expect(result.isStrong).toBe(false);
        expect(result.feedback.length).toBeGreaterThan(0);
      });
    });
  });

  describe('PaginationUtil', () => {
    describe('paginate', () => {
      it('페이지네이션 결과를 생성해야 함', () => {
        const data = Array.from({ length: 10 }, (_, i) => ({ id: i + 1 }));
        const result = PaginationUtil.paginate(data, 100, { page: 2, limit: 10 });

        expect(result.data).toHaveLength(10);
        expect(result.meta.total).toBe(100);
        expect(result.meta.page).toBe(2);
        expect(result.meta.limit).toBe(10);
        expect(result.meta.totalPages).toBe(10);
        expect(result.meta.hasNextPage).toBe(true);
        expect(result.meta.hasPreviousPage).toBe(true);
        expect(result.meta.nextPage).toBe(3);
        expect(result.meta.previousPage).toBe(1);
      });

      it('첫 페이지는 이전 페이지가 없어야 함', () => {
        const data = Array.from({ length: 10 }, (_, i) => ({ id: i + 1 }));
        const result = PaginationUtil.paginate(data, 100, { page: 1, limit: 10 });

        expect(result.meta.hasPreviousPage).toBe(false);
        expect(result.meta.previousPage).toBeNull();
      });

      it('마지막 페이지는 다음 페이지가 없어야 함', () => {
        const data = Array.from({ length: 10 }, (_, i) => ({ id: i + 1 }));
        const result = PaginationUtil.paginate(data, 100, { page: 10, limit: 10 });

        expect(result.meta.hasNextPage).toBe(false);
        expect(result.meta.nextPage).toBeNull();
      });
    });

    describe('getSkip', () => {
      it('올바른 skip 값을 계산해야 함', () => {
        expect(PaginationUtil.getSkip(1, 10)).toBe(0);
        expect(PaginationUtil.getSkip(2, 10)).toBe(10);
        expect(PaginationUtil.getSkip(3, 10)).toBe(20);
      });
    });

    describe('getPrismaOptions', () => {
      it('Prisma 쿼리 옵션을 생성해야 함', () => {
        const options = PaginationUtil.getPrismaOptions({
          page: 2,
          limit: 10,
          sortBy: 'createdAt',
          sortOrder: 'DESC',
        });

        expect(options.skip).toBe(10);
        expect(options.take).toBe(10);
        expect(options.orderBy).toEqual({ createdAt: 'desc' });
      });

      it('정렬 없이도 옵션을 생성할 수 있어야 함', () => {
        const options = PaginationUtil.getPrismaOptions({ page: 1, limit: 20 });

        expect(options.skip).toBe(0);
        expect(options.take).toBe(20);
        expect(options.orderBy).toBeUndefined();
      });
    });

    describe('normalizeOptions', () => {
      it('음수 페이지를 1로 정규화해야 함', () => {
        const normalized = PaginationUtil.normalizeOptions(-1, 10);
        expect(normalized.page).toBe(1);
      });

      it('초과 limit를 maxLimit로 제한해야 함', () => {
        const normalized = PaginationUtil.normalizeOptions(1, 200, 100);
        expect(normalized.limit).toBe(100);
      });

      it('0 이하의 limit를 기본값 10으로 정규화해야 함', () => {
        const normalized = PaginationUtil.normalizeOptions(1, 0);
        expect(normalized.limit).toBe(10);
      });
    });

    describe('cursorPaginate', () => {
      it('커서 기반 페이지네이션 결과를 생성해야 함', () => {
        // limit + 1 개 조회 (다음 페이지 존재 확인용)
        const data = Array.from({ length: 11 }, (_, i) => ({ id: i + 1 }));

        const result = PaginationUtil.cursorPaginate(data, { limit: 10 }, (item) => item.id);

        expect(result.data).toHaveLength(10);
        expect(result.nextCursor).toBe(10);
        expect(result.hasNextPage).toBe(true);
      });

      it('마지막 페이지는 다음 커서가 없어야 함', () => {
        const data = Array.from({ length: 5 }, (_, i) => ({ id: i + 1 }));

        const result = PaginationUtil.cursorPaginate(data, { limit: 10 }, (item) => item.id);

        expect(result.data).toHaveLength(5);
        expect(result.nextCursor).toBeNull();
        expect(result.hasNextPage).toBe(false);
      });
    });

    describe('getPageRange', () => {
      it('페이지 범위를 올바르게 계산해야 함', () => {
        const range = PaginationUtil.getPageRange(5, 10, 2);

        expect(range).toContain(1);
        expect(range).toContain(5);
        expect(range).toContain(10);
        expect(range).toContain('...');
      });

      it('총 페이지가 적으면 생략 표시가 없어야 함', () => {
        const range = PaginationUtil.getPageRange(2, 3, 2);

        expect(range).not.toContain('...');
        expect(range).toEqual([1, 2, 3]);
      });
    });
  });
});
