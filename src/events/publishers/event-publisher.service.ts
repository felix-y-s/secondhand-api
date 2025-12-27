import { Injectable, Inject, Logger } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RabbitMQConnectionService } from '../../rabbitmq/rabbitmq-connection.service';
import { BaseEvent } from '../types/event.types';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { v4 as uuidv4 } from 'uuid';

/**
 * 이벤트 발행 옵션
 */
export interface PublishOptions {
  /** 메시지 우선순위 (0-10, 10이 가장 높음) */
  priority?: number;

  /** 메시지 만료 시간 (milliseconds) */
  expiration?: string;

  /** 메시지 지속성 여부 */
  persistent?: boolean;

  /** 재시도 횟수 */
  maxRetries?: number;
}

/**
 * 이벤트 발행자 서비스
 *
 * 기능:
 * - 로컬 이벤트 발행 (같은 프로세스 내 EventEmitter)
 * - 분산 이벤트 발행 (RabbitMQ를 통한 다른 서비스로)
 * - 하이브리드 발행 (로컬 + 분산 동시)
 */
@Injectable()
export class EventPublisherService {
  constructor(
    private readonly rabbitMQConnection: RabbitMQConnectionService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  /**
   * 로컬 이벤트 발행 (같은 프로세스 내)
   *
   * @param event - 발행할 이벤트
   */
  emitLocal<T extends BaseEvent>(event: T): void {
    this.logger.log(
      `로컬 이벤트 발행: ${event.eventType} | ID: ${event.eventId}`,
      'EventPublisherService',
    );

    this.eventEmitter.emit(event.eventType, event);
  }

  /**
   * 분산 이벤트 발행 (RabbitMQ를 통한 다른 서비스로)
   *
   * @param event - 발행할 이벤트
   * @param options - 발행 옵션
   */
  async emitDistributed<T extends BaseEvent>(
    event: T,
    options?: PublishOptions,
  ): Promise<void> {
    // 채널 풀에서 채널 가져오기
    const channel = await this.rabbitMQConnection.getChannel();

    try {
      // 이벤트 ID가 없으면 생성
      if (!event.eventId) {
        event.eventId = uuidv4();
      }

      // 이벤트 타임스탬프가 없으면 생성
      if (!event.timestamp) {
        event.timestamp = new Date();
      }

      this.logger.log(
        `분산 이벤트 발행: ${event.eventType} | ID: ${event.eventId}`,
        'EventPublisherService',
      );

      // Routing Key 생성 (예: user.registered, order.created)
      const routingKey = event.eventType;

      // 메시지 내용
      const message = Buffer.from(JSON.stringify(event));

      // 발행 옵션
      const publishOptions: any = {
        persistent: options?.persistent !== false, // 기본값: true
        contentType: 'application/json',
        timestamp: event.timestamp.getTime(),
      };

      // 우선순위 설정
      if (options?.priority !== undefined) {
        publishOptions.priority = options.priority;
      }

      // 메시지 만료 시간 설정
      if (options?.expiration) {
        publishOptions.expiration = options.expiration;
      }

      // RabbitMQ로 메시지 발행
      await channel.publish(
        'secondhand.events', // Exchange 이름
        routingKey, // Routing Key
        message, // 메시지 내용
        publishOptions, // 발행 옵션
      );

      this.logger.log(
        `✅ 분산 이벤트 발행 성공: ${event.eventType}`,
        'EventPublisherService',
      );
    } catch (error) {
      this.logger.error(
        `❌ 분산 이벤트 발행 실패: ${event.eventType}`,
        error.stack,
        'EventPublisherService',
      );

      // 재시도 로직 (옵션)
      if (options?.maxRetries && options.maxRetries > 0) {
        await this.retryPublish(event, {
          ...options,
          maxRetries: options.maxRetries - 1,
        });
      } else {
        throw error;
      }
    } finally {
      // 🔥 채널을 풀에 반환 (반드시 실행)
      this.rabbitMQConnection.releaseChannel(channel);
    }
  }

  /**
   * 로컬 + 분산 동시 발행
   *
   * @param event - 발행할 이벤트
   * @param options - 발행 옵션
   */
  async emitAll<T extends BaseEvent>(
    event: T,
    options?: PublishOptions,
  ): Promise<void> {
    // 로컬 이벤트 발행
    this.emitLocal(event);

    // 분산 이벤트 발행
    await this.emitDistributed(event, options);
  }

  /**
   * 우선순위 메시지 발행 (알림용)
   *
   * @param event - 발행할 이벤트
   * @param priority - 우선순위 (0-10)
   */
  async emitPriority<T extends BaseEvent>(
    event: T,
    priority: number,
  ): Promise<void> {
    await this.emitDistributed(event, {
      priority,
      persistent: true,
    });
  }

  /**
   * 만료 시간이 있는 메시지 발행
   *
   * @param event - 발행할 이벤트
   * @param expirationMs - 만료 시간 (milliseconds)
   */
  async emitWithExpiration<T extends BaseEvent>(
    event: T,
    expirationMs: number,
  ): Promise<void> {
    await this.emitDistributed(event, {
      expiration: expirationMs.toString(),
      persistent: true,
    });
  }

  /**
   * 재시도 로직
   *
   * @param event - 발행할 이벤트
   * @param options - 발행 옵션
   */
  private async retryPublish<T extends BaseEvent>(
    event: T,
    options: PublishOptions,
  ): Promise<void> {
    this.logger.warn(
      `재시도 중: ${event.eventType} | 남은 재시도: ${options.maxRetries}`,
      'EventPublisherService',
    );

    // 지수 백오프 (1초, 2초, 4초, ...)
    const delay = Math.pow(2, options.maxRetries || 0) * 1000;
    await this.sleep(delay);

    await this.emitDistributed(event, options);
  }

  /**
   * 지연 함수
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
