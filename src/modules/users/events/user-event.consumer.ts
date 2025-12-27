import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RabbitMQConnectionService } from '../../../rabbitmq/rabbitmq-connection.service';
import { ChannelWrapper } from 'amqp-connection-manager';
import { ConsumeMessage } from 'amqplib';

/**
 * ⚠️ User 이벤트 Consumer 예시
 *
 * 특징:
 * - 전용 채널 사용 (장기 실행)
 * - Exchange, Queue, Binding 자율 설정
 * - 자동 추적 및 정리
 */
@Injectable()
export class UserEventConsumer implements OnModuleInit, OnModuleDestroy {
  private consumerChannel: ChannelWrapper;

  constructor(
    private readonly rabbitMQConnection: RabbitMQConnectionService,
  ) {}

  async onModuleInit() {
    // Consumer 전용 채널 생성 (자동 추적됨)
    this.consumerChannel =
      await this.rabbitMQConnection.createConsumerChannel({
        queueName: 'secondhand.users.process',
        exchangeName: 'secondhand.events',
        exchangeType: 'topic',
        routingKey: 'user.*', // user.created, user.updated 등
        prefetchCount: 5, // 동시 5개 메시지 처리
        queueOptions: {
          durable: true,
          deadLetterExchange: 'secondhand.dlx',
          deadLetterRoutingKey: 'users.failed',
        },
      });

    // 메시지 수신 시작
    await this.startConsuming();
  }

  async onModuleDestroy() {
    // Consumer 채널 제거 (추적 목록에서도 제거)
    if (this.consumerChannel) {
      await this.rabbitMQConnection.removeConsumerChannel(this.consumerChannel);
    }
  }

  /**
   * 메시지 수신 시작
   */
  private async startConsuming(): Promise<void> {
    await this.consumerChannel.consume(
      'secondhand.users.process',
      async (msg: ConsumeMessage | null) => {
        if (!msg) return;

        try {
          const event = JSON.parse(msg.content.toString());

          console.log(`📨 User 이벤트 수신: ${event.eventType}`, event);

          // 이벤트 처리
          await this.handleUserEvent(event);

          // 처리 완료 확인
          this.consumerChannel.ack(msg);
        } catch (error) {
          console.error('❌ User 이벤트 처리 실패:', error);

          // 재처리를 위해 NACK (requeue: true)
          this.consumerChannel.nack(msg, false, true);
        }
      },
      {
        noAck: false, // 수동 ACK
      },
    );

    console.log('✅ User 이벤트 수신 시작');
  }

  /**
   * User 이벤트 처리
   */
  private async handleUserEvent(event: any): Promise<void> {
    switch (event.eventType) {
      case 'user.created':
        console.log('새 사용자 생성:', event.userId);
        // 실제 비즈니스 로직
        break;

      case 'user.updated':
        console.log('사용자 정보 업데이트:', event.userId);
        // 실제 비즈니스 로직
        break;

      default:
        console.log('알 수 없는 이벤트:', event.eventType);
    }
  }
}
