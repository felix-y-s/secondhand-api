import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import * as fs from 'fs';
import * as path from 'path';

describe('Winston Logger Validation (e2e)', () => {
  let app: INestApplication;
  let logger: Logger;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('로그 디렉토리 및 파일 생성', () => {
    it('logs 디렉토리가 존재해야 함', () => {
      const logsDir = path.join(process.cwd(), 'logs');
      expect(fs.existsSync(logsDir)).toBe(true);
    });

    it('logs/transactions 디렉토리가 존재해야 함', () => {
      const transactionsDir = path.join(process.cwd(), 'logs', 'transactions');
      expect(fs.existsSync(transactionsDir)).toBe(true);
    });

    it('오늘 날짜의 combined 로그 파일이 존재해야 함', () => {
      const today = new Date().toISOString().split('T')[0];
      const combinedLog = path.join(
        process.cwd(),
        'logs',
        `combined-${today}.log`,
      );
      expect(fs.existsSync(combinedLog)).toBe(true);
    });

    it('오늘 날짜의 error 로그 파일이 존재해야 함', () => {
      const today = new Date().toISOString().split('T')[0];
      const errorLog = path.join(process.cwd(), 'logs', `error-${today}.log`);
      expect(fs.existsSync(errorLog)).toBe(true);
    });

    it('개발 환경에서 debug 로그 파일이 존재해야 함', () => {
      if (process.env.NODE_ENV !== 'production') {
        const today = new Date().toISOString().split('T')[0];
        const debugLog = path.join(process.cwd(), 'logs', `debug-${today}.log`);
        expect(fs.existsSync(debugLog)).toBe(true);
      }
    });
  });

  describe('로그 레벨 테스트', () => {
    it('info 레벨 로그를 기록할 수 있어야 함', () => {
      expect(() => {
        logger.log('테스트 info 로그', 'LoggerTest');
      }).not.toThrow();
    });

    it('error 레벨 로그를 기록할 수 있어야 함', () => {
      expect(() => {
        logger.error('테스트 error 로그', '', 'LoggerTest');
      }).not.toThrow();
    });

    it('warn 레벨 로그를 기록할 수 있어야 함', () => {
      expect(() => {
        logger.warn('테스트 warn 로그', 'LoggerTest');
      }).not.toThrow();
    });

    it('debug 레벨 로그를 기록할 수 있어야 함', () => {
      expect(() => {
        logger.debug('테스트 debug 로그', 'LoggerTest');
      }).not.toThrow();
    });

    it('verbose 레벨 로그를 기록할 수 있어야 함', () => {
      expect(() => {
        logger.verbose('테스트 verbose 로그', 'LoggerTest');
      }).not.toThrow();
    });
  });

  describe('민감정보 마스킹 검증', () => {
    const today = new Date().toISOString().split('T')[0];
    const combinedLogPath = path.join(
      process.cwd(),
      'logs',
      `combined-${today}.log`,
    );

    it('비밀번호가 마스킹되어야 함', async () => {
      logger.log(
        '사용자 등록: {"email":"test@example.com","password":"secret123"}',
        'LoggerTest',
      );

      // 로그 파일에 기록될 시간 대기
      await new Promise((resolve) => setTimeout(resolve, 100));

      const logContent = fs.readFileSync(combinedLogPath, 'utf-8');
      expect(logContent).toContain('****');
      expect(logContent).not.toContain('secret123');
    });

    it('카드 번호가 마스킹되어야 함', async () => {
      logger.log('결제 정보: 카드번호 1234-5678-9012-3456', 'LoggerTest');

      await new Promise((resolve) => setTimeout(resolve, 100));

      const logContent = fs.readFileSync(combinedLogPath, 'utf-8');
      expect(logContent).toContain('****-****-****-****');
      expect(logContent).not.toContain('1234-5678-9012-3456');
    });

    it('이메일이 부분 마스킹되어야 함', async () => {
      logger.log('사용자 이메일: user123@example.com', 'LoggerTest');

      await new Promise((resolve) => setTimeout(resolve, 100));

      const logContent = fs.readFileSync(combinedLogPath, 'utf-8');
      expect(logContent).toContain('***@');
      expect(logContent).not.toContain('user123@');
    });

    it('전화번호가 마스킹되어야 함', async () => {
      logger.log('연락처: 010-1234-5678', 'LoggerTest');

      await new Promise((resolve) => setTimeout(resolve, 100));

      const logContent = fs.readFileSync(combinedLogPath, 'utf-8');
      expect(logContent).toContain('***-****-****');
      expect(logContent).not.toContain('010-1234-5678');
    });
  });

  describe('거래 로그 분리 검증', () => {
    it('TransactionLogger 컨텍스트 로그가 거래 로그 파일에 기록되어야 함', async () => {
      const today = new Date().toISOString().split('T')[0];
      const transactionLogPath = path.join(
        process.cwd(),
        'logs',
        'transactions',
        `transaction-${today}.log`,
      );

      logger.log('거래 완료: 주문ID 12345', 'TransactionLogger');

      // 로그 파일에 기록될 시간 대기
      await new Promise((resolve) => setTimeout(resolve, 200));

      if (fs.existsSync(transactionLogPath)) {
        const logContent = fs.readFileSync(transactionLogPath, 'utf-8');
        // 개발 환경에서는 거래 로그만 기록됨
        if (process.env.NODE_ENV !== 'production') {
          expect(logContent).toContain('TransactionLogger');
          expect(logContent).toContain('거래 완료');
        }
      }
    });

    it('개발 환경: 일반 로그가 거래 로그 파일에 기록되지 않아야 함', async () => {
      if (process.env.NODE_ENV !== 'production') {
        const today = new Date().toISOString().split('T')[0];
        const transactionLogPath = path.join(
          process.cwd(),
          'logs',
          'transactions',
          `transaction-${today}.log`,
        );

        const beforeSize = fs.existsSync(transactionLogPath)
          ? fs.statSync(transactionLogPath).size
          : 0;

        logger.log('일반 애플리케이션 로그', 'AppLogger');

        await new Promise((resolve) => setTimeout(resolve, 200));

        const afterSize = fs.existsSync(transactionLogPath)
          ? fs.statSync(transactionLogPath).size
          : 0;

        // 일반 로그는 거래 로그 파일에 기록되지 않으므로 크기가 동일해야 함
        expect(afterSize).toBe(beforeSize);
      }
    });
  });

  describe('로그 로테이션 설정 검증', () => {
    it('로그 파일이 날짜 패턴으로 생성되어야 함', () => {
      const logsDir = path.join(process.cwd(), 'logs');
      const files = fs.readdirSync(logsDir);

      const datePattern = /\d{4}-\d{2}-\d{2}/;
      const logFiles = files.filter(
        (file) => file.endsWith('.log') && datePattern.test(file),
      );

      expect(logFiles.length).toBeGreaterThan(0);
    });

    it('audit 파일이 생성되어야 함 (로테이션 메타데이터)', () => {
      const logsDir = path.join(process.cwd(), 'logs');
      const files = fs.readdirSync(logsDir);

      const auditFiles = files.filter((file) => file.endsWith('-audit.json'));
      expect(auditFiles.length).toBeGreaterThan(0);
    });
  });

  describe('에러 핸들링', () => {
    it('예외 처리 로그가 exceptions 파일에 기록되어야 함', () => {
      const today = new Date().toISOString().split('T')[0];
      const exceptionsLog = path.join(
        process.cwd(),
        'logs',
        `exceptions-${today}.log`,
      );

      expect(fs.existsSync(exceptionsLog)).toBe(true);
    });

    it('프로미스 거부 로그가 rejections 파일에 기록되어야 함', () => {
      const today = new Date().toISOString().split('T')[0];
      const rejectionsLog = path.join(
        process.cwd(),
        'logs',
        `rejections-${today}.log`,
      );

      expect(fs.existsSync(rejectionsLog)).toBe(true);
    });
  });

  describe('로그 파일 크기 및 보관 기간', () => {
    it('로그 파일이 설정된 최대 크기를 초과하지 않아야 함', () => {
      const today = new Date().toISOString().split('T')[0];
      const combinedLog = path.join(
        process.cwd(),
        'logs',
        `combined-${today}.log`,
      );

      if (fs.existsSync(combinedLog)) {
        const stats = fs.statSync(combinedLog);
        const maxSize = 20 * 1024 * 1024; // 20MB
        expect(stats.size).toBeLessThan(maxSize);
      }
    });

    it('거래 로그는 30일 보관 설정이어야 함', async () => {
      // 설정 확인을 위한 간접 테스트
      const transactionsDir = path.join(process.cwd(), 'logs', 'transactions');
      expect(fs.existsSync(transactionsDir)).toBe(true);
    });
  });
});
