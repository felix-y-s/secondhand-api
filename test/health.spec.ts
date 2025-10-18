import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from '../src/health/health.controller';
import { HealthService } from '../src/health/health.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { MongodbService } from '../src/database/mongodb/mongodb.service';
import { RedisService } from '../src/database/redis/redis.service';

describe('HealthController', () => {
  let controller: HealthController;
  let service: HealthService;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
  };

  const mockMongodbService = {
    isConnected: jest.fn(),
  };

  const mockRedisService = {
    ping: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: MongodbService,
          useValue: mockMongodbService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    service = module.get<HealthService>(HealthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('정의되어야 함', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  describe('check()', () => {
    it('기본 헬스체크를 반환해야 함', () => {
      const result = controller.check();

      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      expect(typeof result.uptime).toBe('number');
    });
  });

  describe('live()', () => {
    it('Liveness probe를 반환해야 함', () => {
      const result = controller.live();

      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
    });
  });

  describe('detailedCheck()', () => {
    it('모든 서비스가 정상일 때 healthy를 반환해야 함', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockMongodbService.isConnected.mockResolvedValue(true);
      mockRedisService.ping.mockResolvedValue('PONG');

      const result = await controller.detailedCheck();

      expect(result.status).toBe('healthy');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('responseTime');
      expect(result).toHaveProperty('services');
      expect(result.services.postgres.status).toBe('healthy');
      expect(result.services.mongodb.status).toBe('healthy');
      expect(result.services.redis.status).toBe('healthy');
    });

    it('PostgreSQL이 실패하면 degraded를 반환해야 함', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(
        new Error('Connection refused'),
      );
      mockMongodbService.isConnected.mockResolvedValue(true);
      mockRedisService.ping.mockResolvedValue('PONG');

      const result = await controller.detailedCheck();

      expect(result.status).toBe('degraded');
      expect(result.services.postgres.status).toBe('unhealthy');
      expect(result.services.postgres.error).toBe('Connection refused');
      expect(result.services.mongodb.status).toBe('healthy');
      expect(result.services.redis.status).toBe('healthy');
    });

    it('MongoDB가 실패하면 degraded를 반환해야 함', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockMongodbService.isConnected.mockResolvedValue(false);
      mockRedisService.ping.mockResolvedValue('PONG');

      const result = await controller.detailedCheck();

      expect(result.status).toBe('degraded');
      expect(result.services.postgres.status).toBe('healthy');
      expect(result.services.mongodb.status).toBe('unhealthy');
      expect(result.services.redis.status).toBe('healthy');
    });

    it('Redis가 실패하면 degraded를 반환해야 함', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockMongodbService.isConnected.mockResolvedValue(true);
      mockRedisService.ping.mockRejectedValue(new Error('Connection timeout'));

      const result = await controller.detailedCheck();

      expect(result.status).toBe('degraded');
      expect(result.services.postgres.status).toBe('healthy');
      expect(result.services.mongodb.status).toBe('healthy');
      expect(result.services.redis.status).toBe('unhealthy');
      expect(result.services.redis.error).toBe('Connection timeout');
    });

    it('모든 서비스가 실패하면 degraded를 반환해야 함', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(new Error('DB Error'));
      mockMongodbService.isConnected.mockResolvedValue(false);
      mockRedisService.ping.mockRejectedValue(new Error('Redis Error'));

      const result = await controller.detailedCheck();

      expect(result.status).toBe('degraded');
      expect(result.services.postgres.status).toBe('unhealthy');
      expect(result.services.mongodb.status).toBe('unhealthy');
      expect(result.services.redis.status).toBe('unhealthy');
    });
  });

  describe('ready()', () => {
    it('PostgreSQL과 Redis가 정상이면 ok를 반환해야 함', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedisService.ping.mockResolvedValue('PONG');

      const result = await controller.ready();

      expect(result.status).toBe('ok');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
    });

    it('PostgreSQL이 실패하면 not_ready를 반환해야 함', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(
        new Error('Connection refused'),
      );
      mockRedisService.ping.mockResolvedValue('PONG');

      const result = await controller.ready();

      expect(result.status).toBe('not_ready');
    });

    it('Redis가 실패하면 not_ready를 반환해야 함', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedisService.ping.mockRejectedValue(new Error('Connection timeout'));

      const result = await controller.ready();

      expect(result.status).toBe('not_ready');
    });

    it('PostgreSQL과 Redis가 모두 실패하면 not_ready를 반환해야 함', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(new Error('DB Error'));
      mockRedisService.ping.mockRejectedValue(new Error('Redis Error'));

      const result = await controller.ready();

      expect(result.status).toBe('not_ready');
    });
  });
});
