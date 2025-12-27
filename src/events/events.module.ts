import { Module, Global } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { EventPublisherService } from './publishers/event-publisher.service';

/**
 * 이벤트 모듈
 *
 * 전역 모듈로 설정되어 애플리케이션 전체에서 사용 가능
 *
 * 기능:
 * - 로컬 이벤트 발행/구독 (EventEmitter)
 * - 분산 이벤트 발행 (RabbitMQ)
 * - 이벤트 핸들러 관리
 */
@Global()
@Module({
  imports: [
    // RabbitMQ 모듈 (순환 의존성 방지를 위해 명시적 import)
    RabbitMQModule,
    // EventEmitter 설정
    EventEmitterModule.forRoot({
      // 와일드카드 사용 가능 (예: user.*, order.*)
      wildcard: true,
      // 구분자 설정 (예: user.registered, order.created)
      delimiter: '.',
      // 에러 발생 시 계속 진행
      verboseMemoryLeak: true,
      // 최대 리스너 수 (기본값 10)
      maxListeners: 20,
    }),
  ],
  providers: [EventPublisherService],
  exports: [EventPublisherService, EventEmitterModule],
})
export class EventsModule {}
