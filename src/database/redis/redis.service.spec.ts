import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';
import { REDIS_CLIENT } from './redis.module';

describe('RedisService', () => {
  let service: RedisService;

  const mockRedisClient = {
    set: jest.fn(),
    setex: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    ttl: jest.fn(),
    keys: jest.fn(),
    hset: jest.fn(),
    hget: jest.fn(),
    hgetall: jest.fn(),
    hdel: jest.fn(),
    lpush: jest.fn(),
    lpop: jest.fn(),
    lrange: jest.fn(),
    sadd: jest.fn(),
    smembers: jest.fn(),
    srem: jest.fn(),
    ping: jest.fn(),
    flushall: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: REDIS_CLIENT,
          useValue: mockRedisClient,
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('서비스가 정의되어야 함', () => {
    expect(service).toBeDefined();
  });

  describe('기본 Key-Value 작업', () => {
    describe('set', () => {
      it('TTL 없이 값을 저장해야 함', async () => {
        const key = 'test-key';
        const value = { data: 'test-value' };

        mockRedisClient.set.mockResolvedValue('OK');

        await service.set(key, value);

        expect(mockRedisClient.set).toHaveBeenCalledWith(
          key,
          JSON.stringify(value),
        );
        expect(mockRedisClient.setex).not.toHaveBeenCalled();
      });

      it('TTL과 함께 값을 저장해야 함', async () => {
        const key = 'test-key';
        const value = { data: 'test-value' };
        const ttl = 3600;

        mockRedisClient.setex.mockResolvedValue('OK');

        await service.set(key, value, ttl);

        expect(mockRedisClient.setex).toHaveBeenCalledWith(
          key,
          ttl,
          JSON.stringify(value),
        );
        expect(mockRedisClient.set).not.toHaveBeenCalled();
      });

      it('문자열 값을 그대로 저장해야 함', async () => {
        const key = 'test-key';
        const value = 'simple-string';

        mockRedisClient.set.mockResolvedValue('OK');

        await service.set(key, value);

        expect(mockRedisClient.set).toHaveBeenCalledWith(key, value);
      });
    });

    describe('get', () => {
      it('JSON 객체를 파싱하여 반환해야 함', async () => {
        const key = 'test-key';
        const value = { data: 'test-value' };

        mockRedisClient.get.mockResolvedValue(JSON.stringify(value));

        const result = await service.get(key);

        expect(mockRedisClient.get).toHaveBeenCalledWith(key);
        expect(result).toEqual(value);
      });

      it('문자열 값을 그대로 반환해야 함', async () => {
        const key = 'test-key';
        const value = 'simple-string';

        mockRedisClient.get.mockResolvedValue(value);

        const result = await service.get(key);

        expect(result).toBe(value);
      });

      it('존재하지 않는 키는 null을 반환해야 함', async () => {
        mockRedisClient.get.mockResolvedValue(null);

        const result = await service.get('non-existent');

        expect(result).toBeNull();
      });
    });

    describe('delete', () => {
      it('키를 삭제해야 함', async () => {
        const key = 'test-key';

        mockRedisClient.del.mockResolvedValue(1);

        const result = await service.delete(key);

        expect(mockRedisClient.del).toHaveBeenCalledWith(key);
        expect(result).toBe(1);
      });
    });

    describe('exists', () => {
      it('키가 존재하면 true를 반환해야 함', async () => {
        mockRedisClient.exists.mockResolvedValue(1);

        const result = await service.exists('existing-key');

        expect(result).toBe(true);
      });

      it('키가 존재하지 않으면 false를 반환해야 함', async () => {
        mockRedisClient.exists.mockResolvedValue(0);

        const result = await service.exists('non-existent');

        expect(result).toBe(false);
      });
    });

    describe('getTTL', () => {
      it('키의 남은 TTL을 반환해야 함', async () => {
        const ttl = 3600;

        mockRedisClient.ttl.mockResolvedValue(ttl);

        const result = await service.getTTL('test-key');

        expect(result).toBe(ttl);
      });
    });

    describe('keys', () => {
      it('패턴에 맞는 키 목록을 반환해야 함', async () => {
        const pattern = 'user:*';
        const keys = ['user:1', 'user:2', 'user:3'];

        mockRedisClient.keys.mockResolvedValue(keys);

        const result = await service.keys(pattern);

        expect(mockRedisClient.keys).toHaveBeenCalledWith(pattern);
        expect(result).toEqual(keys);
      });
    });
  });

  describe('Hash 작업', () => {
    describe('hset', () => {
      it('Hash 필드를 설정해야 함', async () => {
        const key = 'user:1';
        const field = 'name';
        const value = { firstName: 'John', lastName: 'Doe' };

        mockRedisClient.hset.mockResolvedValue(1);

        const result = await service.hset(key, field, value);

        expect(mockRedisClient.hset).toHaveBeenCalledWith(
          key,
          field,
          JSON.stringify(value),
        );
        expect(result).toBe(1);
      });

      it('문자열 값을 그대로 저장해야 함', async () => {
        const key = 'user:1';
        const field = 'status';
        const value = 'active';

        mockRedisClient.hset.mockResolvedValue(1);

        await service.hset(key, field, value);

        expect(mockRedisClient.hset).toHaveBeenCalledWith(key, field, value);
      });
    });

    describe('hget', () => {
      it('Hash 필드 값을 조회해야 함', async () => {
        const key = 'user:1';
        const field = 'name';
        const value = { firstName: 'John', lastName: 'Doe' };

        mockRedisClient.hget.mockResolvedValue(JSON.stringify(value));

        const result = await service.hget(key, field);

        expect(mockRedisClient.hget).toHaveBeenCalledWith(key, field);
        expect(result).toEqual(value);
      });

      it('존재하지 않는 필드는 null을 반환해야 함', async () => {
        mockRedisClient.hget.mockResolvedValue(null);

        const result = await service.hget('user:1', 'non-existent');

        expect(result).toBeNull();
      });
    });

    describe('hgetall', () => {
      it('Hash 전체를 조회해야 함', async () => {
        const key = 'user:1';
        const hashData = {
          name: JSON.stringify({ firstName: 'John' }),
          age: '30',
          status: 'active',
        };

        mockRedisClient.hgetall.mockResolvedValue(hashData);

        const result = await service.hgetall(key);

        expect(mockRedisClient.hgetall).toHaveBeenCalledWith(key);
        expect(result).toHaveProperty('name', { firstName: 'John' });
        expect(result).toHaveProperty('age', 30);
        expect(result).toHaveProperty('status', 'active');
      });

      it('빈 Hash는 null을 반환해야 함', async () => {
        mockRedisClient.hgetall.mockResolvedValue({});

        const result = await service.hgetall('empty-hash');

        expect(result).toBeNull();
      });
    });

    describe('hdel', () => {
      it('Hash 필드를 삭제해야 함', async () => {
        const key = 'user:1';
        const field = 'temp';

        mockRedisClient.hdel.mockResolvedValue(1);

        const result = await service.hdel(key, field);

        expect(mockRedisClient.hdel).toHaveBeenCalledWith(key, field);
        expect(result).toBe(1);
      });
    });
  });

  describe('List 작업', () => {
    describe('lpush', () => {
      it('List에 값을 추가해야 함', async () => {
        const key = 'queue';
        const value = { taskId: 1, type: 'email' };

        mockRedisClient.lpush.mockResolvedValue(1);

        const result = await service.lpush(key, value);

        expect(mockRedisClient.lpush).toHaveBeenCalledWith(
          key,
          JSON.stringify(value),
        );
        expect(result).toBe(1);
      });
    });

    describe('lpop', () => {
      it('List에서 값을 제거하고 반환해야 함', async () => {
        const key = 'queue';
        const value = { taskId: 1, type: 'email' };

        mockRedisClient.lpop.mockResolvedValue(JSON.stringify(value));

        const result = await service.lpop(key);

        expect(mockRedisClient.lpop).toHaveBeenCalledWith(key);
        expect(result).toEqual(value);
      });

      it('빈 List는 null을 반환해야 함', async () => {
        mockRedisClient.lpop.mockResolvedValue(null);

        const result = await service.lpop('empty-list');

        expect(result).toBeNull();
      });
    });

    describe('lrange', () => {
      it('List 범위를 조회해야 함', async () => {
        const key = 'history';
        const values = [
          JSON.stringify({ action: 'login' }),
          JSON.stringify({ action: 'view' }),
        ];

        mockRedisClient.lrange.mockResolvedValue(values);

        const result = await service.lrange(key, 0, -1);

        expect(mockRedisClient.lrange).toHaveBeenCalledWith(key, 0, -1);
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ action: 'login' });
        expect(result[1]).toEqual({ action: 'view' });
      });
    });
  });

  describe('Set 작업', () => {
    describe('sadd', () => {
      it('Set에 멤버를 추가해야 함', async () => {
        const key = 'tags';
        const members = ['electronics', 'mobile', 'new'];

        mockRedisClient.sadd.mockResolvedValue(3);

        const result = await service.sadd(key, ...members);

        expect(mockRedisClient.sadd).toHaveBeenCalledWith(key, ...members);
        expect(result).toBe(3);
      });

      it('객체를 JSON으로 변환하여 추가해야 함', async () => {
        const key = 'users';
        const member = { id: 1, name: 'John' };

        mockRedisClient.sadd.mockResolvedValue(1);

        await service.sadd(key, member);

        expect(mockRedisClient.sadd).toHaveBeenCalledWith(
          key,
          JSON.stringify(member),
        );
      });
    });

    describe('smembers', () => {
      it('Set의 모든 멤버를 조회해야 함', async () => {
        const key = 'tags';
        const members = ['electronics', 'mobile', 'new'];

        mockRedisClient.smembers.mockResolvedValue(members);

        const result = await service.smembers(key);

        expect(mockRedisClient.smembers).toHaveBeenCalledWith(key);
        expect(result).toEqual(members);
      });

      it('JSON 객체를 파싱하여 반환해야 함', async () => {
        const key = 'users';
        const members = [JSON.stringify({ id: 1, name: 'John' })];

        mockRedisClient.smembers.mockResolvedValue(members);

        const result = await service.smembers(key);

        expect(result[0]).toEqual({ id: 1, name: 'John' });
      });
    });

    describe('srem', () => {
      it('Set에서 멤버를 제거해야 함', async () => {
        const key = 'tags';
        const member = 'old';

        mockRedisClient.srem.mockResolvedValue(1);

        const result = await service.srem(key, member);

        expect(mockRedisClient.srem).toHaveBeenCalledWith(key, member);
        expect(result).toBe(1);
      });
    });
  });

  describe('유틸리티', () => {
    describe('ping', () => {
      it('Redis 연결 상태를 확인해야 함', async () => {
        mockRedisClient.ping.mockResolvedValue('PONG');

        const result = await service.ping();

        expect(mockRedisClient.ping).toHaveBeenCalled();
        expect(result).toBe('PONG');
      });
    });

    describe('flushall', () => {
      it('모든 키를 삭제해야 함', async () => {
        mockRedisClient.flushall.mockResolvedValue('OK');

        const result = await service.flushall();

        expect(mockRedisClient.flushall).toHaveBeenCalled();
        expect(result).toBe('OK');
      });
    });
  });
});
