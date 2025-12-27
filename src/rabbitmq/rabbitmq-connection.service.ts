import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
} from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqp-connection-manager';
import { ChannelWrapper } from 'amqp-connection-manager';
import { ConfirmChannel } from 'amqplib';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { ConsumerChannelOptions } from './types/channel.types';

/**
 * RabbitMQ 연결 관리 서비스 (개선 버전)
 *
 * 주요 개선사항:
 * 1. 송신/수신 채널 완전 분리
 * 2. 송신: 채널 풀 사용 (빌림 → 사용 → 반환)
 * 3. 수신: 전용 채널 사용 (생성 → 계속 점유)
 * 4. Consumer가 자율적으로 Exchange/Queue/Binding 설정
 * 5. 모든 채널 추적 및 안전한 정리
 *
 * 네이밍 규칙:
 * - Exchange: secondhand.{type}
 * - Queue: secondhand.{domain}.{purpose}
 * - Routing Key: {domain}.{action}
 */
@Injectable()
export class RabbitMQConnectionService
  implements OnModuleInit, OnModuleDestroy
{
  private connection: amqp.AmqpConnectionManager;

  // 송신 전용 채널 풀
  private publisherChannelPool: ChannelWrapper[] = [];
  private publisherChannelsInUse: Set<ChannelWrapper> = new Set();

  // 수신 채널 추적
  private consumerChannels: Set<ChannelWrapper> = new Set();

  // 설정
  private poolSize: number;

  constructor(
    private configService: ConfigService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {
    this.poolSize = this.configService.get<number>(
      'rabbitmq.channelPoolSize',
      5,
    );
  }

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  /**
   * RabbitMQ 연결 초기화
   */
  private async connect(): Promise<void> {
    const host = this.configService.get<string>('rabbitmq.host');
    const port = this.configService.get<number>('rabbitmq.port');
    const user = this.configService.get<string>('rabbitmq.user');
    const password = this.configService.get<string>('rabbitmq.password');
    const vhost = this.configService.get<string>('rabbitmq.vhost');

    const url = `amqp://${user}:${password}@${host}:${port}${vhost}`;

    this.logger.log(`RabbitMQ 연결 시작`, 'RabbitMQConnectionService');

    // 자동 재연결 지원
    this.connection = amqp.connect([url], {
      heartbeatIntervalInSeconds: 30,
      reconnectTimeInSeconds: 1,
    });

    // 연결 이벤트
    this.connection.on('connect', () => {
      this.logger.log('✅ RabbitMQ 연결 성공', 'RabbitMQConnectionService');
    });

    this.connection.on('disconnect', (err) => {
      this.logger.error(
        '❌ RabbitMQ 연결 끊김',
        err.err,
        'RabbitMQConnectionService',
      );
    });

    this.connection.on('blocked', (reason) => {
      this.logger.warn(
        `⚠️ RabbitMQ 연결 블록됨: ${reason}`,
        'RabbitMQConnectionService',
      );
    });

    this.connection.on('unblocked', () => {
      this.logger.log(
        '✅ RabbitMQ 연결 블록 해제',
        'RabbitMQConnectionService',
      );
    });

    // 1. 공통 Exchange 초기 생성 (선택적)
    await this.setupCommonExchanges();

    // 2. 송신 전용 채널 풀 생성
    await this.createPublisherChannelPool();

    this.logger.log(
      `✅ RabbitMQ 초기화 완료 (Publisher 채널 풀: ${this.poolSize}개)`,
      'RabbitMQConnectionService',
    );
  }

  /**
   * 공통 Exchange 초기 생성 (선택적)
   *
   * 목적:
   * - 자주 사용하는 Exchange를 미리 생성
   * - 하지만 필수는 아님 (Consumer가 직접 생성 가능)
   */
  private async setupCommonExchanges(): Promise<void> {
    this.logger.log(
      '공통 Exchange 초기화 중...',
      'RabbitMQConnectionService',
    );

    const setupChannel = this.connection.createChannel({
      json: false,
      setup: async (ch: ConfirmChannel) => {
        // 이벤트 Exchange (Topic 타입 - 패턴 매칭)
        await ch.assertExchange('secondhand.events', 'topic', {
          durable: true,
        });

        // 명령 Exchange (Direct 타입 - 정확한 매칭)
        await ch.assertExchange('secondhand.commands', 'direct', {
          durable: true,
        });

        // Dead Letter Exchange (실패한 메시지 처리)
        await ch.assertExchange('secondhand.dlx', 'topic', {
          durable: true,
        });

        this.logger.log(
          '✅ 공통 Exchange 초기화 완료',
          'RabbitMQConnectionService',
        );
      },
    });

    await setupChannel.waitForConnect();

    // Exchange 생성 후 임시 채널 닫기
    await setupChannel.close();
  }

  /**
   * 송신 전용 채널 풀 생성
   *
   * 특징:
   * - 인프라 설정 없음 (Exchange는 이미 생성됨)
   * - publish()만 사용
   * - 빠른 빌림/반환
   */
  private async createPublisherChannelPool(): Promise<void> {
    this.logger.log(
      `송신 채널 풀 생성 중... (크기: ${this.poolSize})`,
      'RabbitMQConnectionService',
    );

    for (let i = 0; i < this.poolSize; i++) {
      // setup 없이 순수 채널만 생성
      const channel = this.connection.createChannel({
        json: false,
      });

      await channel.waitForConnect();
      this.publisherChannelPool.push(channel);

      this.logger.log(
        `송신 채널 #${i + 1} 생성 완료`,
        'RabbitMQConnectionService',
      );
    }
  }

  /**
   * 송신용 채널 가져오기
   *
   * 용도: publish() 전용
   * 특징: 빌려서 사용 후 즉시 반환
   */
  async getPublisherChannel(): Promise<ChannelWrapper> {
    // 사용 가능한 채널 찾기
    const availableChannel = this.publisherChannelPool.find(
      (channel) => !this.publisherChannelsInUse.has(channel),
    );

    if (availableChannel) {
      this.publisherChannelsInUse.add(availableChannel);
      this.logger.log(
        `송신 채널 가져옴 (사용 중: ${this.publisherChannelsInUse.size}/${this.publisherChannelPool.length})`,
        'RabbitMQConnectionService',
      );
      return availableChannel;
    }

    // 모든 채널이 사용 중이면 새로 생성 (동적 확장)
    this.logger.warn(
      `모든 송신 채널 사용 중 - 새 채널 생성 (풀 크기: ${this.publisherChannelPool.length})`,
      'RabbitMQConnectionService',
    );

    const newChannel = this.connection.createChannel({
      json: false,
    });

    await newChannel.waitForConnect();
    this.publisherChannelPool.push(newChannel);
    this.publisherChannelsInUse.add(newChannel);

    return newChannel;
  }

  /**
   * 송신 채널 반환
   */
  releasePublisherChannel(channel: ChannelWrapper): void {
    if (this.publisherChannelsInUse.has(channel)) {
      this.publisherChannelsInUse.delete(channel);
      this.logger.log(
        `송신 채널 반환 (사용 중: ${this.publisherChannelsInUse.size}/${this.publisherChannelPool.length})`,
        'RabbitMQConnectionService',
      );
    } else {
      this.logger.warn(
        '반환하려는 채널이 사용 중 목록에 없습니다',
        'RabbitMQConnectionService',
      );
    }
  }

  /**
   * Consumer용 전용 채널 생성
   *
   * 기능:
   * 1. Exchange 확인/생성
   * 2. Queue 생성 및 설정
   * 3. Exchange-Queue 바인딩
   * 4. Prefetch 설정
   *
   * 특징:
   * - 장기 실행 (consume 리스닝)
   * - 자율적 인프라 설정
   * - 자동 추적 (정리 보장)
   */
  async createConsumerChannel(
    options: ConsumerChannelOptions,
  ): Promise<ChannelWrapper> {
    const {
      queueName,
      exchangeName = 'secondhand.events',
      exchangeType = 'topic',
      exchangeOptions = {},
      routingKey,
      queueOptions = {},
      prefetchCount = 1,
    } = options;

    this.logger.log(
      `Consumer 채널 생성: Queue=${queueName}, Exchange=${exchangeName}`,
      'RabbitMQConnectionService',
    );

    const channel = this.connection.createChannel({
      json: false,
      setup: async (ch: ConfirmChannel) => {
        // 1. Exchange 확인/생성 (멱등성 보장)
        await ch.assertExchange(exchangeName, exchangeType, {
          durable: exchangeOptions.durable !== false,
          autoDelete: exchangeOptions.autoDelete || false,
          internal: exchangeOptions.internal || false,
        });

        this.logger.log(
          `Exchange 확인/생성: ${exchangeName} (${exchangeType})`,
          'RabbitMQConnectionService',
        );

        // 2. Queue 생성
        const queueArgs: any = {};

        if (queueOptions.deadLetterExchange) {
          queueArgs.deadLetterExchange = queueOptions.deadLetterExchange;
        }
        if (queueOptions.deadLetterRoutingKey) {
          queueArgs.deadLetterRoutingKey = queueOptions.deadLetterRoutingKey;
        }
        if (queueOptions.messageTtl) {
          queueArgs.messageTtl = queueOptions.messageTtl;
        }
        if (queueOptions.maxLength) {
          queueArgs.maxLength = queueOptions.maxLength;
        }

        await ch.assertQueue(queueName, {
          durable: queueOptions.durable !== false,
          exclusive: queueOptions.exclusive || false,
          autoDelete: queueOptions.autoDelete || false,
          maxPriority: queueOptions.maxPriority,
          arguments: queueArgs,
        });

        this.logger.log(`Queue 생성: ${queueName}`, 'RabbitMQConnectionService');

        // 3. Binding (Exchange ← Queue)
        if (routingKey) {
          await ch.bindQueue(queueName, exchangeName, routingKey);

          this.logger.log(
            `바인딩: ${queueName} ← ${exchangeName} [${routingKey}]`,
            'RabbitMQConnectionService',
          );
        }

        // 4. Prefetch 설정
        await ch.prefetch(prefetchCount);

        this.logger.log(
          `✅ Consumer 채널 설정 완료 (prefetch: ${prefetchCount})`,
          'RabbitMQConnectionService',
        );
      },
    });

    await channel.waitForConnect();

    // 생성된 Consumer 채널 추적
    this.consumerChannels.add(channel);

    this.logger.log(
      `Consumer 채널 추가 (총 ${this.consumerChannels.size}개)`,
      'RabbitMQConnectionService',
    );

    return channel;
  }

  /**
   * Consumer 채널 제거
   *
   * Consumer가 더 이상 필요 없을 때 호출
   * (예: Consumer 서비스의 onModuleDestroy)
   */
  async removeConsumerChannel(channel: ChannelWrapper): Promise<void> {
    if (this.consumerChannels.has(channel)) {
      try {
        await channel.close();
        this.consumerChannels.delete(channel);

        this.logger.log(
          `Consumer 채널 제거 (남은 Consumer 채널: ${this.consumerChannels.size}개)`,
          'RabbitMQConnectionService',
        );
      } catch (error) {
        this.logger.error(
          '❌ Consumer 채널 종료 실패',
          error.stack,
          'RabbitMQConnectionService',
        );
      }
    } else {
      this.logger.warn(
        '제거하려는 Consumer 채널이 추적 목록에 없습니다',
        'RabbitMQConnectionService',
      );
    }
  }

  /**
   * RabbitMQ 연결 종료
   *
   * 순서:
   * 1. Consumer 채널 종료
   * 2. Publisher 채널 종료
   * 3. 연결 종료
   */
  private async disconnect(): Promise<void> {
    try {
      // 1. 모든 Consumer 채널 종료
      this.logger.log(
        `Consumer 채널 종료 중... (${this.consumerChannels.size}개)`,
        'RabbitMQConnectionService',
      );

      const consumerClosePromises = Array.from(this.consumerChannels).map(
        async (channel) => {
          try {
            await channel.close();
          } catch (error) {
            this.logger.error(
              '❌ Consumer 채널 종료 실패',
              error.stack,
              'RabbitMQConnectionService',
            );
          }
        },
      );

      await Promise.all(consumerClosePromises);
      this.consumerChannels.clear();

      this.logger.log(
        '✅ 모든 Consumer 채널 종료',
        'RabbitMQConnectionService',
      );

      // 2. 모든 Publisher 채널 종료
      this.logger.log(
        `Publisher 채널 종료 중... (${this.publisherChannelPool.length}개)`,
        'RabbitMQConnectionService',
      );

      const publisherClosePromises = this.publisherChannelPool.map(
        async (channel) => {
          try {
            await channel.close();
          } catch (error) {
            this.logger.error(
              '❌ Publisher 채널 종료 실패',
              error.stack,
              'RabbitMQConnectionService',
            );
          }
        },
      );

      await Promise.all(publisherClosePromises);
      this.publisherChannelPool = [];
      this.publisherChannelsInUse.clear();

      this.logger.log(
        '✅ 모든 Publisher 채널 종료',
        'RabbitMQConnectionService',
      );

      // 3. 연결 종료
      if (this.connection) {
        await this.connection.close();
        this.logger.log('✅ RabbitMQ 연결 종료', 'RabbitMQConnectionService');
      }
    } catch (error) {
      this.logger.error(
        '❌ RabbitMQ 종료 중 에러 발생',
        error.stack,
        'RabbitMQConnectionService',
      );
    }
  }

  /**
   * 채널 상태 조회 (디버깅/모니터링용)
   */
  getChannelStats() {
    return {
      publisherChannels: {
        total: this.publisherChannelPool.length,
        inUse: this.publisherChannelsInUse.size,
        available:
          this.publisherChannelPool.length - this.publisherChannelsInUse.size,
      },
      consumerChannels: {
        total: this.consumerChannels.size,
      },
    };
  }

  /**
   * 연결 상태 확인
   */
  isConnected(): boolean {
    return this.connection?.isConnected() || false;
  }

  /**
   * 채널 상태 확인
   */
  isChannelConnected(): boolean {
    return this.publisherChannelPool.length > 0 && this.isConnected();
  }

  // ========================================
  // 하위 호환성을 위한 별칭 (deprecated)
  // ========================================

  /**
   * @deprecated getPublisherChannel()을 사용하세요
   */
  async getChannel(): Promise<ChannelWrapper> {
    return this.getPublisherChannel();
  }

  /**
   * @deprecated releasePublisherChannel()을 사용하세요
   */
  releaseChannel(channel: ChannelWrapper): void {
    this.releasePublisherChannel(channel);
  }

  /**
   * @deprecated getPublisherChannel()을 사용하세요
   */
  getChannelWrapper(): ChannelWrapper {
    if (this.publisherChannelPool.length === 0) {
      throw new Error('RabbitMQ 채널이 초기화되지 않았습니다.');
    }
    return this.publisherChannelPool[0];
  }
}
