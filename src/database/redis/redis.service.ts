import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.module';

/**
 * Redis 테스트용 서비스
 * 캐싱 및 세션 관리 기능
 */
@Injectable()
export class RedisService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  // ===== 기본 Key-Value 작업 =====

  /**
   * 값 저장 (TTL 옵션)
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const stringValue =
      typeof value === 'string' ? value : JSON.stringify(value);

    if (ttlSeconds) {
      await this.redis.setex(key, ttlSeconds, stringValue);
    } else {
      await this.redis.set(key, stringValue);
    }
  }

  /**
   * 값 조회
   */
  async get<T = any>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  /**
   * 값 삭제
   */
  async delete(key: string): Promise<number> {
    return this.redis.del(key);
  }

  /**
   * 키 존재 여부 확인
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result === 1;
  }

  /**
   * TTL 조회 (남은 시간)
   */
  async getTTL(key: string): Promise<number> {
    return this.redis.ttl(key);
  }

  /**
   * 패턴으로 키 검색
   */
  async keys(pattern: string): Promise<string[]> {
    return this.redis.keys(pattern);
  }

  // ===== Hash 작업 (객체 저장용) =====

  /**
   * Hash 필드 설정
   */
  async hset(key: string, field: string, value: any): Promise<number> {
    const stringValue =
      typeof value === 'string' ? value : JSON.stringify(value);
    return this.redis.hset(key, field, stringValue);
  }

  /**
   * Hash 필드 조회
   */
  async hget<T = any>(key: string, field: string): Promise<T | null> {
    const value = await this.redis.hget(key, field);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  /**
   * Hash 전체 조회
   */
  async hgetall<T = any>(key: string): Promise<T | null> {
    const value = await this.redis.hgetall(key);
    if (!value || Object.keys(value).length === 0) return null;

    // JSON 파싱 시도
    const parsed: any = {};
    for (const [field, val] of Object.entries(value)) {
      try {
        parsed[field] = JSON.parse(val);
      } catch {
        parsed[field] = val;
      }
    }
    return parsed as T;
  }

  /**
   * Hash 필드 삭제
   */
  async hdel(key: string, field: string): Promise<number> {
    return this.redis.hdel(key, field);
  }

  // ===== List 작업 (큐/스택용) =====

  /**
   * List 끝에 추가 (Push)
   */
  async lpush(key: string, value: any): Promise<number> {
    const stringValue =
      typeof value === 'string' ? value : JSON.stringify(value);
    return this.redis.lpush(key, stringValue);
  }

  /**
   * List 시작에서 제거 (Pop)
   */
  async lpop<T = any>(key: string): Promise<T | null> {
    const value = await this.redis.lpop(key);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  /**
   * List 범위 조회
   */
  async lrange<T = any>(
    key: string,
    start: number,
    stop: number,
  ): Promise<T[]> {
    const values = await this.redis.lrange(key, start, stop);
    return values.map((value) => {
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    });
  }

  // ===== Set 작업 (중복 없는 집합) =====

  /**
   * Set에 멤버 추가
   */
  async sadd(key: string, ...members: any[]): Promise<number> {
    const stringMembers = members.map((m) =>
      typeof m === 'string' ? m : JSON.stringify(m),
    );
    return this.redis.sadd(key, ...stringMembers);
  }

  /**
   * Set의 모든 멤버 조회
   */
  async smembers<T = any>(key: string): Promise<T[]> {
    const members = await this.redis.smembers(key);
    return members.map((m) => {
      try {
        return JSON.parse(m) as T;
      } catch {
        return m as T;
      }
    });
  }

  /**
   * Set에서 멤버 제거
   */
  async srem(key: string, member: any): Promise<number> {
    const stringMember =
      typeof member === 'string' ? member : JSON.stringify(member);
    return this.redis.srem(key, stringMember);
  }

  // ===== 유틸리티 =====

  /**
   * Redis 연결 상태 확인
   */
  async ping(): Promise<string> {
    return this.redis.ping();
  }

  /**
   * 모든 키 삭제 (주의: 테스트 용도만!)
   */
  async flushall(): Promise<string> {
    return this.redis.flushall();
  }
}
