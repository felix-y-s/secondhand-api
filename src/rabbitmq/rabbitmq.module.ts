import { Module, Global } from '@nestjs/common';
import { RabbitMQConnectionService } from './rabbitmq-connection.service';

/**
 * RabbitMQ 모듈
 *
 * 전역 모듈로 설정되어 애플리케이션 전체에서 사용 가능
 *
 * 기능:
 * - RabbitMQ 연결 관리
 * - Exchange, Queue, Binding 자동 설정
 * - 채널 Wrapper 제공
 */
@Global()
@Module({
  providers: [RabbitMQConnectionService],
  exports: [RabbitMQConnectionService],
})
export class RabbitMQModule {}
