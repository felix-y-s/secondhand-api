import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../src/database/redis/redis.service';
import { REDIS_CLIENT } from '../src/database/redis/redis.module';
import Redis from 'ioredis';

describe('RedisService 통합 테스트 (실제 Redis 연동)', () => {
  let service: RedisService;
  let moduleRef: TestingModule;
  let redisClient: Redis;

  // 테스트용 키 프리픽스
  const TEST_PREFIX = 'integration-test:';

  beforeAll(async () => {
    // 실제 Redis 클라이언트 생성
    redisClient = new Redis({
      host: 'localhost',
      port: 6379,
    });

    moduleRef = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: REDIS_CLIENT,
          useValue: redisClient,
        },
      ],
    }).compile();

    service = moduleRef.get<RedisService>(RedisService);
  }, 30000); // 30초 타임아웃

  afterAll(async () => {
    // 테스트 데이터 정리
    if (service) {
      const testKeys = await service.keys(`${TEST_PREFIX}*`);
      for (const key of testKeys) {
        await service.delete(key);
      }
    }
    if (redisClient) {
      await redisClient.quit();
    }
    await moduleRef.close();
  });

  describe('기본 Key-Value 작업 통합 테스트', () => {
    const testKey = `${TEST_PREFIX}simple-key`;

    it('문자열 값을 저장하고 조회할 수 있어야 함', async () => {
      const value = 'Hello Redis!';

      await service.set(testKey, value);
      const retrieved = await service.get(testKey);

      expect(retrieved).toBe(value);
    });

    it('객체 값을 저장하고 조회할 수 있어야 함', async () => {
      const objectKey = `${TEST_PREFIX}object-key`;
      const value = {
        userId: 12345,
        username: 'testuser',
        email: 'test@example.com',
      };

      await service.set(objectKey, value);
      const retrieved = await service.get(objectKey);

      expect(retrieved).toEqual(value);
      await service.delete(objectKey);
    });

    it('TTL과 함께 값을 저장할 수 있어야 함', async () => {
      const ttlKey = `${TEST_PREFIX}ttl-key`;
      const value = 'expires soon';
      const ttl = 5; // 5초

      await service.set(ttlKey, value, ttl);

      // 값 확인
      const retrieved = await service.get(ttlKey);
      expect(retrieved).toBe(value);

      // TTL 확인
      const remainingTtl = await service.getTTL(ttlKey);
      expect(remainingTtl).toBeGreaterThan(0);
      expect(remainingTtl).toBeLessThanOrEqual(ttl);

      await service.delete(ttlKey);
    });

    it('키가 존재하는지 확인할 수 있어야 함', async () => {
      const existsKey = `${TEST_PREFIX}exists-key`;

      // 키가 없을 때
      let exists = await service.exists(existsKey);
      expect(exists).toBe(false);

      // 키를 생성
      await service.set(existsKey, 'test');

      // 키가 있을 때
      exists = await service.exists(existsKey);
      expect(exists).toBe(true);

      await service.delete(existsKey);
    });

    it('키를 삭제할 수 있어야 함', async () => {
      const deleteKey = `${TEST_PREFIX}delete-key`;

      await service.set(deleteKey, 'will be deleted');
      const deleted = await service.delete(deleteKey);

      expect(deleted).toBe(1);

      const retrieved = await service.get(deleteKey);
      expect(retrieved).toBeNull();
    });

    it('패턴으로 키를 검색할 수 있어야 함', async () => {
      // 여러 키 생성
      await service.set(`${TEST_PREFIX}search:1`, 'value1');
      await service.set(`${TEST_PREFIX}search:2`, 'value2');
      await service.set(`${TEST_PREFIX}search:3`, 'value3');

      const keys = await service.keys(`${TEST_PREFIX}search:*`);

      expect(keys).toHaveLength(3);
      expect(keys).toContain(`${TEST_PREFIX}search:1`);
      expect(keys).toContain(`${TEST_PREFIX}search:2`);
      expect(keys).toContain(`${TEST_PREFIX}search:3`);

      // 정리
      for (const key of keys) {
        await service.delete(key);
      }
    });
  });

  describe('Hash 작업 통합 테스트', () => {
    const hashKey = `${TEST_PREFIX}user:profile`;

    afterEach(async () => {
      await service.delete(hashKey);
    });

    it('Hash 필드를 설정하고 조회할 수 있어야 함', async () => {
      const field = 'name';
      const value = { firstName: 'John', lastName: 'Doe' };

      await service.hset(hashKey, field, value);
      const retrieved = await service.hget(hashKey, field);

      expect(retrieved).toEqual(value);
    });

    it('Hash 전체를 조회할 수 있어야 함', async () => {
      // 여러 필드 설정
      await service.hset(hashKey, 'name', 'John Doe');
      await service.hset(hashKey, 'age', 30);
      await service.hset(hashKey, 'city', 'Seoul');

      const allFields = await service.hgetall(hashKey);

      expect(allFields).toHaveProperty('name', 'John Doe');
      expect(allFields).toHaveProperty('age', 30);
      expect(allFields).toHaveProperty('city', 'Seoul');
    });

    it('Hash 필드를 삭제할 수 있어야 함', async () => {
      await service.hset(hashKey, 'temp', 'temporary value');
      await service.hset(hashKey, 'keep', 'keep this');

      const deleted = await service.hdel(hashKey, 'temp');
      expect(deleted).toBe(1);

      const allFields = await service.hgetall(hashKey);
      expect(allFields).not.toHaveProperty('temp');
      expect(allFields).toHaveProperty('keep');
    });
  });

  describe('List 작업 통합 테스트', () => {
    const listKey = `${TEST_PREFIX}queue`;

    afterEach(async () => {
      await service.delete(listKey);
    });

    it('List에 값을 추가하고 제거할 수 있어야 함', async () => {
      const task1 = { id: 1, type: 'email', data: 'send email' };
      const task2 = { id: 2, type: 'notification', data: 'push notification' };

      // 값 추가
      await service.lpush(listKey, task1);
      await service.lpush(listKey, task2);

      // 값 제거 (LIFO - Last In First Out)
      const popped1 = await service.lpop(listKey);
      expect(popped1).toEqual(task2);

      const popped2 = await service.lpop(listKey);
      expect(popped2).toEqual(task1);

      // 빈 리스트
      const popped3 = await service.lpop(listKey);
      expect(popped3).toBeNull();
    });

    it('List 범위를 조회할 수 있어야 함', async () => {
      // 값들 추가
      await service.lpush(listKey, { action: 'login' });
      await service.lpush(listKey, { action: 'view_product' });
      await service.lpush(listKey, { action: 'add_to_cart' });

      // 전체 조회
      const allItems = await service.lrange(listKey, 0, -1);
      expect(allItems).toHaveLength(3);

      // 부분 조회
      const firstTwo = await service.lrange(listKey, 0, 1);
      expect(firstTwo).toHaveLength(2);
    });
  });

  describe('Set 작업 통합 테스트', () => {
    const setKey = `${TEST_PREFIX}tags`;

    afterEach(async () => {
      await service.delete(setKey);
    });

    it('Set에 멤버를 추가하고 조회할 수 있어야 함', async () => {
      // 멤버 추가
      await service.sadd(setKey, 'electronics', 'mobile', 'smartphone');

      // 멤버 조회
      const members = await service.smembers(setKey);

      expect(members).toHaveLength(3);
      expect(members).toContain('electronics');
      expect(members).toContain('mobile');
      expect(members).toContain('smartphone');
    });

    it('Set에서 중복 멤버는 무시되어야 함', async () => {
      await service.sadd(setKey, 'tag1');
      await service.sadd(setKey, 'tag1'); // 중복
      await service.sadd(setKey, 'tag2');

      const members = await service.smembers(setKey);
      expect(members).toHaveLength(2); // tag1은 한 번만 저장
    });

    it('Set에서 멤버를 삭제할 수 있어야 함', async () => {
      await service.sadd(setKey, 'keep1', 'remove', 'keep2');

      const removed = await service.srem(setKey, 'remove');
      expect(removed).toBe(1);

      const members = await service.smembers(setKey);
      expect(members).toHaveLength(2);
      expect(members).not.toContain('remove');
    });

    it('객체를 Set에 저장할 수 있어야 함', async () => {
      const user1 = { id: 1, name: 'User1' };
      const user2 = { id: 2, name: 'User2' };

      await service.sadd(setKey, user1, user2);

      const members = await service.smembers(setKey);
      expect(members).toHaveLength(2);
      expect(members).toContainEqual(user1);
      expect(members).toContainEqual(user2);
    });
  });

  describe('유틸리티 통합 테스트', () => {
    it('Redis 연결 상태를 확인할 수 있어야 함', async () => {
      const response = await service.ping();
      expect(response).toBe('PONG');
    });
  });

  describe('실제 사용 시나리오 테스트', () => {
    it('사용자 세션 저장 및 조회', async () => {
      const sessionKey = `${TEST_PREFIX}session:user:12345`;
      const sessionData = {
        userId: 12345,
        username: 'testuser',
        loginAt: new Date().toISOString(),
        permissions: ['read', 'write'],
      };

      // 30분 TTL로 세션 저장
      await service.set(sessionKey, sessionData, 1800);

      // 세션 조회
      const retrieved = await service.get(sessionKey);
      expect(retrieved).toEqual(sessionData);
      expect(retrieved.userId).toBe(12345);

      await service.delete(sessionKey);
    });

    it('상품 조회수 카운터 (Hash)', async () => {
      const productKey = `${TEST_PREFIX}product:stats:999`;

      // 조회수 초기화
      await service.hset(productKey, 'views', 0);
      await service.hset(productKey, 'likes', 0);

      // 조회수 증가 시뮬레이션
      for (let i = 0; i < 5; i++) {
        const currentViews = (await service.hget(productKey, 'views')) || 0;
        await service.hset(productKey, 'views', Number(currentViews) + 1);
      }

      const stats = await service.hgetall(productKey);
      expect(stats.views).toBe(5);
      expect(stats.likes).toBe(0);

      await service.delete(productKey);
    });

    it('최근 검색어 저장 (List)', async () => {
      const searchKey = `${TEST_PREFIX}recent-searches:user:123`;

      // 검색어 추가
      await service.lpush(searchKey, '노트북');
      await service.lpush(searchKey, '스마트폰');
      await service.lpush(searchKey, '태블릿');

      // 최근 3개 검색어 조회
      const recentSearches = await service.lrange(searchKey, 0, 2);

      expect(recentSearches).toHaveLength(3);
      expect(recentSearches[0]).toBe('태블릿'); // 가장 최근
      expect(recentSearches[2]).toBe('노트북'); // 가장 오래된

      await service.delete(searchKey);
    });

    it('상품 카테고리 태그 (Set)', async () => {
      const categoryKey = `${TEST_PREFIX}product:888:categories`;

      // 카테고리 추가
      await service.sadd(categoryKey, '전자기기', '스마트폰', 'Apple', '중고');

      // 중복 추가 시도
      await service.sadd(categoryKey, '스마트폰'); // 이미 존재

      const categories = await service.smembers(categoryKey);
      expect(categories).toHaveLength(4); // 중복 제거됨

      await service.delete(categoryKey);
    });
  });
});
