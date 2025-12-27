/**
 * Common Events - 공통 이벤트 유틸리티
 *
 * 모든 도메인에서 재사용 가능한 이벤트 관련 공통 코드
 */

// 이벤트 모듈
export { EventsModule } from './events.module';

// 이벤트 발행 서비스
export { EventPublisherService } from './event-publisher.service';
export type { PublishOptions } from './event-publisher.service';

// 베이스 이벤트 핸들러
export { BaseEventHandler, BaseLocalEventHandler } from './base-event.handler';

// 이벤트 타입 정의
export * from './types/event.types';
