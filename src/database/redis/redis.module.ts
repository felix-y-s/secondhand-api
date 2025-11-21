import { Module, Global, DynamicModule, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from './redis.service';

/**
 * Redis 연결 Provider
 * ioredis 클라이언트를 전역으로 제공
 */
export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * Redis 모듈
 * 캐싱, 세션 관리, 실시간 데이터 처리에 사용
 */
@Global()
@Module({})
export class RedisModule implements OnModuleDestroy {
  static redis: Redis;
  static forRoot(): DynamicModule {
    const redisProvider = {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService) => {
        RedisModule.redis = new Redis({
          host: configService.get<string>('database.redis.host'),
          port: configService.get<number>('database.redis.port'),
          password: configService.get<string>('database.redis.password'),
          retryStrategy: (times: number) => {
            // 재연결 전략: 최대 10번 시도, 각 시도마다 1초씩 증가
            if (times > 10) {
              return null; // 연결 포기
            }
            return times * 1000;
          },
        });

        // 연결 성공 이벤트
        RedisModule.redis.on('connect', () => {
          console.log('✅ Redis 연결 성공');
        });

        // 연결 실패 이벤트
        RedisModule.redis.on('error', (err) => {
          console.error('❌ Redis 연결 오류:', err);
        });

        RedisModule.redis.on('end', () => {
          console.log('❌ Redis 연결 종료');
        });

        return RedisModule.redis;
      },
      inject: [ConfigService],
    };

    return {
      module: RedisModule,
      providers: [redisProvider, RedisService],
      exports: [REDIS_CLIENT, RedisService],
    };
  }

  async onModuleDestroy() {
    if (!RedisModule.redis) return;
    
    // 모든 이벤트 리스너 제거
    RedisModule.redis.removeAllListeners('connect');
    RedisModule.redis.removeAllListeners('error');
    RedisModule.redis.removeAllListeners('end');
    
    // Redis 연결 종료
    await RedisModule.redis.quit();
  }
}
