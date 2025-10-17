import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { MongodbService } from '@/database/mongodb/mongodb.service';
import { RedisService } from '@/database/redis/redis.service';
import { HealthResponseDto, DetailedHealthResponseDto, ServiceStatus } from './dto/health-response.dto';

/**
 * 헬스체크 서비스
 *
 * 시스템 및 연동 서비스 상태 확인
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mongodb: MongodbService,
    private readonly redis: RedisService,
  ) {}

  /**
   * 기본 헬스체크
   *
   * @returns 서버 실행 상태
   */
  check(): HealthResponseDto {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /**
   * 상세 헬스체크
   *
   * PostgreSQL, MongoDB, Redis 연결 상태 확인
   *
   * @returns 상세 헬스체크 결과
   */
  async detailedCheck(): Promise<DetailedHealthResponseDto> {
    const startTime = Date.now();

    // 병렬로 모든 서비스 상태 확인
    const [postgresStatus, mongoStatus, redisStatus] = await Promise.all([
      this.checkPostgreSQL(),
      this.checkMongoDB(),
      this.checkRedis(),
    ]);

    const responseTime = Date.now() - startTime;

    // 전체 상태 결정: 하나라도 unhealthy면 degraded
    const allHealthy =
      postgresStatus.status === 'healthy' && mongoStatus.status === 'healthy' && redisStatus.status === 'healthy';

    const overallStatus = allHealthy ? 'healthy' : 'degraded';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime,
      services: {
        postgres: postgresStatus,
        mongodb: mongoStatus,
        redis: redisStatus,
      },
    };
  }

  /**
   * Readiness Check
   *
   * 서버가 트래픽을 받을 준비가 되었는지 확인
   * 필수 서비스(PostgreSQL, Redis)가 정상이어야 ready
   *
   * @returns Readiness 상태
   */
  async readinessCheck(): Promise<HealthResponseDto> {
    try {
      const [postgresStatus, redisStatus] = await Promise.all([this.checkPostgreSQL(), this.checkRedis()]);

      const isReady = postgresStatus.status === 'healthy' && redisStatus.status === 'healthy';

      if (!isReady) {
        this.logger.warn('Readiness check failed', {
          postgres: postgresStatus.status,
          redis: redisStatus.status,
        });
      }

      return {
        status: isReady ? 'ok' : 'not_ready',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };
    } catch (error) {
      this.logger.error('Readiness check error', error);
      return {
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };
    }
  }

  /**
   * PostgreSQL 연결 상태 확인
   *
   * @returns PostgreSQL 상태
   */
  private async checkPostgreSQL(): Promise<ServiceStatus> {
    const startTime = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        responseTime,
        message: 'PostgreSQL 연결 정상',
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.error('PostgreSQL health check failed', error);

      return {
        status: 'unhealthy',
        responseTime,
        message: 'PostgreSQL 연결 실패',
        error: error.message,
      };
    }
  }

  /**
   * MongoDB 연결 상태 확인
   *
   * @returns MongoDB 상태
   */
  private async checkMongoDB(): Promise<ServiceStatus> {
    const startTime = Date.now();
    try {
      const isConnected = await this.mongodb.isConnected();
      const responseTime = Date.now() - startTime;

      if (isConnected) {
        return {
          status: 'healthy',
          responseTime,
          message: 'MongoDB 연결 정상',
        };
      } else {
        return {
          status: 'unhealthy',
          responseTime,
          message: 'MongoDB 연결 끊김',
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.error('MongoDB health check failed', error);

      return {
        status: 'unhealthy',
        responseTime,
        message: 'MongoDB 연결 실패',
        error: error.message,
      };
    }
  }

  /**
   * Redis 연결 상태 확인
   *
   * @returns Redis 상태
   */
  private async checkRedis(): Promise<ServiceStatus> {
    const startTime = Date.now();
    try {
      await this.redis.ping();
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        responseTime,
        message: 'Redis 연결 정상',
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.error('Redis health check failed', error);

      return {
        status: 'unhealthy',
        responseTime,
        message: 'Redis 연결 실패',
        error: error.message,
      };
    }
  }
}
