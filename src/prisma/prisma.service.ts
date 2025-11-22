import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma 서비스
 * - Prisma Client 연결 관리
 * - 애플리케이션 생명주기와 연동
 * - 데이터베이스 연결 풀 관리
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        {
          emit: 'event',
          level: 'query',
        },
        {
          emit: 'event',
          level: 'error',
        },
        {
          emit: 'event',
          level: 'info',
        },
        {
          emit: 'event',
          level: 'warn',
        },
      ],
      errorFormat: 'pretty',
    });

    // 쿼리 로깅 (개발 환경에서만)
    if (process.env.NODE_ENV === 'development') {
      this.$on('query' as never, (e: any) => {
        this.logger.debug(`Query: ${e.query}`);
        this.logger.debug(`Params: ${e.params}`);
        this.logger.debug(`Duration: ${e.duration}ms`);
      });
    }

    // 에러 로깅
    this.$on('error' as never, (e: any) => {
      this.logger.error(`Prisma Error: ${e.message}`, e.stack);
    });

    // 경고 로깅
    this.$on('warn' as never, (e: any) => {
      this.logger.warn(`Prisma Warning: ${e.message}`);
    });
  }

  /**
   * 모듈 초기화 시 데이터베이스 연결
   */
  async onModuleInit() {
    try {
      await this.$connect();
      
      // 데이터베이스 연결 정보 파싱
      const dbUrl = process.env.DATABASE_URL || '';
      const dbInfo = this.parseDatabaseUrl(dbUrl);
      
      this.logger.log('✅ PostgreSQL 데이터베이스 연결 성공');
      this.logger.log(`📍 Host: ${dbInfo.host}`);
      this.logger.log(`🔌 Port: ${dbInfo.port}`);
      this.logger.log(`💾 Database: ${dbInfo.database}`);
      this.logger.log(`👤 User: ${dbInfo.user}`);
    } catch (error) {
      this.logger.error('❌ PostgreSQL 데이터베이스 연결 실패', error);
      throw error;
    }
  }

  /**
   * DATABASE_URL 파싱하여 연결 정보 추출
   * @param url DATABASE_URL 문자열
   * @returns 파싱된 연결 정보
   */
  private parseDatabaseUrl(url: string): {
    host: string;
    port: string;
    database: string;
    user: string;
  } {
    try {
      // postgresql://user:password@host:port/database 형식 파싱
      const urlPattern = /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
      const match = url.match(urlPattern);

      if (match) {
        return {
          user: match[1],
          host: match[3],
          port: match[4],
          database: match[5].split('?')[0], // 쿼리 파라미터 제거
        };
      }

      // 파싱 실패 시 기본값 반환
      return {
        host: 'unknown',
        port: 'unknown',
        database: 'unknown',
        user: 'unknown',
      };
    } catch (error) {
      this.logger.warn('DATABASE_URL 파싱 실패');
      return {
        host: 'unknown',
        port: 'unknown',
        database: 'unknown',
        user: 'unknown',
      };
    }
  }

  /**
   * 모듈 종료 시 데이터베이스 연결 해제
   */
  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('✅ PostgreSQL 데이터베이스 연결 해제');
    } catch (error) {
      this.logger.error('❌ PostgreSQL 데이터베이스 연결 해제 실패', error);
    }
  }

  /**
   * 데이터베이스 상태 확인
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('❌ 데이터베이스 상태 확인 실패', error);
      return false;
    }
  }

  /**
   * 트랜잭션 헬퍼
   */
  async executeTransaction<T>(
    operations: (
      prisma: Omit<
        PrismaClient,
        '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'
      >,
    ) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(operations);
  }
}
