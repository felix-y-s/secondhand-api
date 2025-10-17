import { Logger, Inject } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { BaseEvent } from '../types/event.types';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

/**
 * 이벤트 핸들러 베이스 클래스
 *
 * 모든 도메인 이벤트 핸들러가 상속해야 하는 추상 클래스
 *
 * 기능:
 * - 로깅
 * - 에러 처리
 * - 재시도 로직
 * - 메트릭 수집 (선택)
 */
export abstract class BaseEventHandler<T extends BaseEvent> {
  /**
   * 핸들러 이름 (로깅용)
   */
  protected abstract readonly handlerName: string;

  /**
   * 최대 재시도 횟수
   */
  protected maxRetries: number = 3;

  /**
   * 재시도 지연 시간 (milliseconds)
   */
  protected retryDelay: number = 1000;

  /**
   * 이벤트 처리 (구현 필요)
   */
  abstract handle(event: T): Promise<void>;

  /**
   * 이벤트 처리 with 에러 핸들링 및 재시도
   */
  async execute(
    event: T,
    logger: LoggerService,
    retryCount: number = 0,
  ): Promise<void> {
    try {
      this.logEvent(event, logger);
      await this.handle(event);
      this.logSuccess(event, logger);
    } catch (error) {
      this.logError(event, error, logger);

      // 재시도 로직
      if (retryCount < this.maxRetries) {
        await this.retry(event, logger, retryCount + 1);
      } else {
        // 최대 재시도 횟수 초과
        this.logMaxRetriesExceeded(event, logger);
        throw error;
      }
    }
  }

  /**
   * 재시도 로직
   */
  private async retry(
    event: T,
    logger: LoggerService,
    retryCount: number,
  ): Promise<void> {
    logger.warn(
      `재시도 중 (${retryCount}/${this.maxRetries}): ${event.eventType} | ID: ${event.eventId}`,
      this.handlerName,
    );

    // 지수 백오프 (1초, 2초, 4초, ...)
    const delay = this.retryDelay * Math.pow(2, retryCount - 1);
    await this.sleep(delay);

    await this.execute(event, logger, retryCount);
  }

  /**
   * 이벤트 로깅
   */
  protected logEvent(event: T, logger: LoggerService): void {
    logger.log(
      `이벤트 처리 시작: ${event.eventType} | ID: ${event.eventId}`,
      this.handlerName,
    );
  }

  /**
   * 성공 로깅
   */
  protected logSuccess(event: T, logger: LoggerService): void {
    logger.log(
      `✅ 이벤트 처리 완료: ${event.eventType} | ID: ${event.eventId}`,
      this.handlerName,
    );
  }

  /**
   * 에러 로깅
   */
  protected logError(
    event: T,
    error: Error,
    logger: LoggerService,
  ): void {
    logger.error(
      `❌ 이벤트 처리 실패: ${event.eventType} | ID: ${event.eventId} | 오류: ${error.message}`,
      error.stack,
      this.handlerName,
    );
  }

  /**
   * 최대 재시도 횟수 초과 로깅
   */
  protected logMaxRetriesExceeded(
    event: T,
    logger: LoggerService,
  ): void {
    logger.error(
      `🚨 최대 재시도 횟수 초과: ${event.eventType} | ID: ${event.eventId}`,
      this.handlerName,
    );
  }

  /**
   * 지연 함수
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * NestJS 이벤트 리스너용 베이스 핸들러
 *
 * @nestjs/event-emitter의 @OnEvent 데코레이터와 함께 사용
 */
export abstract class BaseLocalEventHandler<
  T extends BaseEvent,
> extends BaseEventHandler<T> {
  @Inject(WINSTON_MODULE_NEST_PROVIDER)
  protected logger: LoggerService;

  /**
   * 로컬 이벤트 처리 (NestJS EventEmitter용)
   */
  async handleEvent(event: T): Promise<void> {
    await this.execute(event, this.logger);
  }
}
