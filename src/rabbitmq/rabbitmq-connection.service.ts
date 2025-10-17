import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  Inject,
} from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqp-connection-manager';
import { ChannelWrapper } from 'amqp-connection-manager';
import { ConfirmChannel } from 'amqplib';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

/**
 * RabbitMQ 연결 관리 서비스
 *
 * 기능:
 * - 자동 재연결 지원
 * - Exchange, Queue, Binding 설정
 * - Dead Letter Queue (DLQ) 처리
 * - 연결 상태 모니터링
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
  private channelWrapper: ChannelWrapper;

  constructor(
    private configService: ConfigService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

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
    // configuration에서 RabbitMQ 설정 가져오기
    const host = this.configService.get<string>('rabbitmq.host');
    const port = this.configService.get<number>('rabbitmq.port');
    const user = this.configService.get<string>('rabbitmq.user');
    const password = this.configService.get<string>('rabbitmq.password');
    const vhost = this.configService.get<string>('rabbitmq.vhost');
    
    // RabbitMQ URL 생성
    const url = `amqp://${user}:${password}@${host}:${port}${vhost}`;

    this.logger.log(`RabbitMQ 연결 시작: ${url}`, 'RabbitMQConnectionService');

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

    // 채널 생성
    this.channelWrapper = this.connection.createChannel({
      json: false,
      setup: async (channel: ConfirmChannel) => {
        await this.setupInfrastructure(channel);
      },
    });

    await this.channelWrapper.waitForConnect();
    this.logger.log('✅ RabbitMQ 초기화 완료', 'RabbitMQConnectionService');
  }

  /**
   * Exchange, Queue, Binding 설정
   *
   * 네이밍 컨벤션:
   * - Exchange: secondhand.{type} (예: secondhand.events, secondhand.commands)
   * - Queue: secondhand.{domain}.{purpose} (예: secondhand.orders.process)
   * - Routing Key: {domain}.{action} (예: order.created, payment.completed)
   */
  private async setupInfrastructure(channel: ConfirmChannel): Promise<void> {
    try {
      // ========================================
      // Exchange 설정
      // ========================================

      // 이벤트 Exchange (Topic 타입 - 패턴 매칭 가능)
      await channel.assertExchange('secondhand.events', 'topic', {
        durable: true,
      });

      // 명령 Exchange (Direct 타입 - 정확한 매칭)
      await channel.assertExchange('secondhand.commands', 'direct', {
        durable: true,
      });

      // Dead Letter Exchange (실패한 메시지 처리)
      await channel.assertExchange('secondhand.dlx', 'topic', {
        durable: true,
      });

      // ========================================
      // 주문 (Orders) 큐 설정
      // ========================================

      // 주문 처리 큐
      await channel.assertQueue('secondhand.orders.process', {
        durable: true,
        deadLetterExchange: 'secondhand.dlx',
        deadLetterRoutingKey: 'orders.failed',
      });
      await channel.bindQueue(
        'secondhand.orders.process',
        'secondhand.events',
        'order.*',
      );

      // 주문 실패 큐 (Dead Letter Queue)
      await channel.assertQueue('secondhand.orders.dead-letter', {
        durable: true,
      });
      await channel.bindQueue(
        'secondhand.orders.dead-letter',
        'secondhand.dlx',
        'orders.failed',
      );

      // ========================================
      // 결제 (Payments) 큐 설정
      // ========================================

      // 결제 처리 큐
      await channel.assertQueue('secondhand.payments.process', {
        durable: true,
        deadLetterExchange: 'secondhand.dlx',
        deadLetterRoutingKey: 'payments.failed',
      });
      await channel.bindQueue(
        'secondhand.payments.process',
        'secondhand.events',
        'payment.*',
      );

      // 결제 실패 큐
      await channel.assertQueue('secondhand.payments.dead-letter', {
        durable: true,
      });
      await channel.bindQueue(
        'secondhand.payments.dead-letter',
        'secondhand.dlx',
        'payments.failed',
      );

      // ========================================
      // 알림 (Notifications) 큐 설정
      // ========================================

      // 알림 발송 큐 (우선순위 큐)
      await channel.assertQueue('secondhand.notifications.send', {
        durable: true,
        maxPriority: 10, // 우선순위 0-10 (10이 가장 높음)
      });
      await channel.bindQueue(
        'secondhand.notifications.send',
        'secondhand.events',
        'notification.*',
      );

      // ========================================
      // 사용자 (Users) 큐 설정
      // ========================================

      // 사용자 처리 큐
      await channel.assertQueue('secondhand.users.process', {
        durable: true,
        deadLetterExchange: 'secondhand.dlx',
        deadLetterRoutingKey: 'users.failed',
      });
      await channel.bindQueue(
        'secondhand.users.process',
        'secondhand.events',
        'user.*',
      );

      // 사용자 실패 큐
      await channel.assertQueue('secondhand.users.dead-letter', {
        durable: true,
      });
      await channel.bindQueue(
        'secondhand.users.dead-letter',
        'secondhand.dlx',
        'users.failed',
      );

      // ========================================
      // 상품 (Products) 큐 설정
      // ========================================

      // 상품 처리 큐
      await channel.assertQueue('secondhand.products.process', {
        durable: true,
        deadLetterExchange: 'secondhand.dlx',
        deadLetterRoutingKey: 'products.failed',
      });
      await channel.bindQueue(
        'secondhand.products.process',
        'secondhand.events',
        'product.*',
      );

      // 상품 실패 큐
      await channel.assertQueue('secondhand.products.dead-letter', {
        durable: true,
      });
      await channel.bindQueue(
        'secondhand.products.dead-letter',
        'secondhand.dlx',
        'products.failed',
      );

      this.logger.log(
        '✅ RabbitMQ 인프라 설정 완료',
        'RabbitMQConnectionService',
      );
    } catch (error) {
      this.logger.error(
        '❌ RabbitMQ 인프라 설정 실패',
        error.stack,
        'RabbitMQConnectionService',
      );
      throw error;
    }
  }

  /**
   * RabbitMQ 연결 종료
   */
  private async disconnect(): Promise<void> {
    try {
      if (this.channelWrapper) {
        await this.channelWrapper.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      this.logger.log('✅ RabbitMQ 연결 종료', 'RabbitMQConnectionService');
    } catch (error) {
      this.logger.error(
        '❌ RabbitMQ 연결 종료 실패',
        error.stack,
        'RabbitMQConnectionService',
      );
    }
  }

  /**
   * 채널 Wrapper 반환
   */
  getChannelWrapper(): ChannelWrapper {
    if (!this.channelWrapper) {
      throw new Error('RabbitMQ 채널이 초기화되지 않았습니다.');
    }
    return this.channelWrapper;
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
    return this.channelWrapper !== undefined && this.isConnected();
  }
}
