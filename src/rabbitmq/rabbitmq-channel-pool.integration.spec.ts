import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { RabbitMQConnectionService } from './rabbitmq-connection.service';
import { EventPublisherService } from '../events/publishers/event-publisher.service';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { winstonConfig } from '../config/logger.config';
import { ChannelWrapper } from 'amqp-connection-manager';
import configuration from '../config/configuration';
import {
  EventType,
  UserRegisteredEvent,
} from '../events/types/event.types';

/**
 * RabbitMQ 채널 풀링 통합 테스트
 *
 * 테스트 목표:
 * 1. 채널 풀이 올바르게 생성되는지 확인
 * 2. getChannel/releaseChannel이 정상 동작하는지 확인
 * 3. 동적 확장이 작동하는지 확인
 * 4. 동시성 처리가 올바른지 확인
 *
 * 사전 요구사항:
 * - RabbitMQ 서버가 실행 중이어야 함
 * - docker-compose up -d rabbitmq
 */
describe('RabbitMQ 채널 풀링 통합 테스트', () => {
  let moduleRef: TestingModule;
  let rabbitMQService: RabbitMQConnectionService;
  let eventPublisher: EventPublisherService;

  // 테스트 타임아웃 설정
  jest.setTimeout(30000);

  beforeAll(async () => {
    // 테스트 모듈 초기화
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
          envFilePath: '.env.development',
        }),
        WinstonModule.forRoot(winstonConfig),
        EventEmitterModule.forRoot({
          wildcard: true,
          delimiter: '.',
        }),
      ],
      providers: [RabbitMQConnectionService, EventPublisherService],
    }).compile();

    rabbitMQService = moduleRef.get<RabbitMQConnectionService>(
      RabbitMQConnectionService,
    );
    eventPublisher =
      moduleRef.get<EventPublisherService>(EventPublisherService);

    // RabbitMQ 초기화
    await rabbitMQService.onModuleInit();

    // 연결 대기
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  describe('채널 풀 초기화 테스트', () => {
    it('RabbitMQ에 연결되어야 함', () => {
      expect(rabbitMQService.isConnected()).toBe(true);
    });

    it('채널 풀이 생성되어야 함', () => {
      expect(rabbitMQService.isChannelConnected()).toBe(true);
    });
  });

  describe('채널 가져오기/반환 테스트', () => {
    it('getChannel()로 채널을 가져올 수 있어야 함', async () => {
      const channel = await rabbitMQService.getChannel();

      expect(channel).toBeDefined();
      expect(channel).toBeTruthy();

      // 채널 반환
      rabbitMQService.releaseChannel(channel);
    });

    it('여러 채널을 동시에 가져올 수 있어야 함', async () => {
      const channels: ChannelWrapper[] = [];

      // 풀 크기만큼 채널 가져오기 (기본 5개)
      for (let i = 0; i < 5; i++) {
        const channel = await rabbitMQService.getChannel();
        channels.push(channel);
        expect(channel).toBeDefined();
      }

      // 모든 채널이 서로 다른 객체여야 함 (동시성 보장)
      const uniqueChannels = new Set(channels);
      expect(uniqueChannels.size).toBe(5);

      // 모든 채널 반환
      channels.forEach((channel) => {
        rabbitMQService.releaseChannel(channel);
      });
    });

    it('채널을 반환하면 다시 사용할 수 있어야 함', async () => {
      // 채널 가져오기
      const channel1 = await rabbitMQService.getChannel();
      expect(channel1).toBeDefined();

      // 채널 반환
      rabbitMQService.releaseChannel(channel1);

      // 같은 채널을 다시 가져올 수 있어야 함
      const channel2 = await rabbitMQService.getChannel();
      expect(channel2).toBeDefined();
      expect(channel2).toBe(channel1); // 재사용 확인

      rabbitMQService.releaseChannel(channel2);
    });
  });

  describe('동적 확장 테스트', () => {
    it('풀 크기를 초과하면 새 채널이 생성되어야 함', async () => {
      const channels: ChannelWrapper[] = [];

      // 풀 크기(5개)보다 많은 채널 요청 (7개)
      for (let i = 0; i < 7; i++) {
        const channel = await rabbitMQService.getChannel();
        channels.push(channel);
      }

      // 모든 채널이 서로 달라야 함
      const uniqueChannels = new Set(channels);
      expect(uniqueChannels.size).toBe(7);

      // 모든 채널 반환
      channels.forEach((channel) => {
        rabbitMQService.releaseChannel(channel);
      });
    });
  });

  describe('동시성 테스트', () => {
    it('여러 요청이 동시에 들어와도 정상 처리되어야 함', async () => {
      const promises: Promise<ChannelWrapper>[] = [];

      // 10개의 동시 요청
      for (let i = 0; i < 10; i++) {
        promises.push(rabbitMQService.getChannel());
      }

      const channels = await Promise.all(promises);

      // 모든 채널이 정상적으로 반환되어야 함
      expect(channels).toHaveLength(10);
      channels.forEach((channel) => {
        expect(channel).toBeDefined();
      });

      // 모든 채널 반환
      channels.forEach((channel) => {
        rabbitMQService.releaseChannel(channel);
      });
    });

    it('채널을 사용하면서 동시에 반환해도 안전해야 함', async () => {
      const operations: Promise<void>[] = [];

      // 20번의 "가져오기 → 사용 → 반환" 작업을 동시에 실행
      for (let i = 0; i < 20; i++) {
        const operation = (async () => {
          const channel = await rabbitMQService.getChannel();
          // 짧은 작업 시뮬레이션
          await new Promise((resolve) => setTimeout(resolve, 10));
          rabbitMQService.releaseChannel(channel);
        })();

        operations.push(operation);
      }

      // 모든 작업이 에러 없이 완료되어야 함
      await expect(Promise.all(operations)).resolves.not.toThrow();
    });
  });

  describe('이벤트 발행 테스트 (채널 풀 사용)', () => {
    it('이벤트 발행 시 채널을 올바르게 사용/반환해야 함', async () => {
      const event: UserRegisteredEvent = {
        eventType: EventType.USER_REGISTERED,
        eventId: 'test-event-1',
        timestamp: new Date(),
        aggregateId: 'user-123',
        userId: 'user-123',
        email: 'test@example.com',
        nickname: 'testuser',
      };

      // 이벤트 발행 (내부에서 채널 가져오기/반환)
      await expect(
        eventPublisher.emitDistributed(event),
      ).resolves.not.toThrow();
    });

    it('여러 이벤트를 동시에 발행해도 정상 처리되어야 함', async () => {
      const promises: Promise<void>[] = [];

      // 10개의 이벤트 동시 발행
      for (let i = 0; i < 10; i++) {
        const event: UserRegisteredEvent = {
          eventType: EventType.USER_REGISTERED,
          eventId: `test-event-${i}`,
          timestamp: new Date(),
          aggregateId: `user-${i}`,
          userId: `user-${i}`,
          email: `test${i}@example.com`,
          nickname: `testuser${i}`,
        };

        promises.push(eventPublisher.emitDistributed(event));
      }

      // 모든 이벤트가 성공적으로 발행되어야 함
      await expect(Promise.all(promises)).resolves.not.toThrow();
    });

    it('에러 발생 시에도 채널이 반환되어야 함', async () => {
      // 잘못된 이벤트 (eventType 누락)
      const invalidEvent = {
        eventId: 'invalid-event',
        timestamp: new Date(),
        aggregateId: 'test-123',
      } as any;

      // 에러가 발생하더라도 채널은 반환되어야 함
      try {
        await eventPublisher.emitDistributed(invalidEvent);
      } catch (error) {
        // 에러는 예상된 것
      }

      // 채널이 여전히 사용 가능해야 함
      const channel = await rabbitMQService.getChannel();
      expect(channel).toBeDefined();
      rabbitMQService.releaseChannel(channel);
    });
  });

  describe('성능 테스트', () => {
    it('100개의 이벤트를 빠르게 처리할 수 있어야 함', async () => {
      const startTime = Date.now();
      const promises: Promise<void>[] = [];

      for (let i = 0; i < 100; i++) {
        const event: UserRegisteredEvent = {
          eventType: EventType.USER_REGISTERED,
          eventId: `perf-test-${i}`,
          timestamp: new Date(),
          aggregateId: `user-${i}`,
          userId: `user-${i}`,
          email: `perf${i}@example.com`,
          nickname: `perfuser${i}`,
        };

        promises.push(eventPublisher.emitDistributed(event));
      }

      await Promise.all(promises);

      const duration = Date.now() - startTime;
      console.log(`100개 이벤트 발행 소요 시간: ${duration}ms`);

      // 100개 이벤트를 10초 이내에 처리해야 함
      expect(duration).toBeLessThan(10000);
    });
  });

  describe('에러 처리 테스트', () => {
    it('이미 반환된 채널을 다시 반환해도 안전해야 함', () => {
      // 가짜 채널 객체
      const fakeChannel = {} as ChannelWrapper;

      // 에러를 발생시키지 않아야 함 (경고 로그만)
      expect(() => {
        rabbitMQService.releaseChannel(fakeChannel);
      }).not.toThrow();
    });
  });
});
