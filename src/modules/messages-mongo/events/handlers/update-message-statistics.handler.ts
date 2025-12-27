import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BaseLocalEventHandler } from '@/events';
import { EventType } from '@/events';
import type { MessageSentEvent } from '@/events';

/**
 * 메시지 발송 후 통계 업데이트 핸들러
 *
 * 책임:
 * - 일일/월별 메시지 전송 통계 업데이트
 * - 사용자별 메시지 전송 통계 업데이트
 */
@Injectable()
export class UpdateMessageStatisticsHandler extends BaseLocalEventHandler<MessageSentEvent> {
  protected readonly handlerName = 'UpdateMessageStatisticsHandler';

  /**
   * MESSAGE_SENT 이벤트 리스닝
   */
  @OnEvent(EventType.MESSAGE_SENT)
  async handleEvent(event: MessageSentEvent): Promise<void> {
    await super.handleEvent(event);
  }

  /**
   * 실제 이벤트 처리 로직
   */
  async handle(event: MessageSentEvent): Promise<void> {
    const { senderId, messageType } = event.data;

    // TODO: 실제 통계 업데이트 로직 구현
    // 1. 일일 메시지 전송 카운트 증가
    // 2. 월별 메시지 전송 카운트 증가
    // 3. 사용자별 메시지 전송 카운트 증가
    // 4. 메시지 타입별 통계 업데이트

    this.logger.log(
      `메시지 통계 업데이트 완료: ${senderId}, 타입: ${messageType}`,
      this.handlerName,
    );

    // 예시: 통계 업데이트
    console.log(`[통계 업데이트] 사용자 ${senderId}의 메시지 전송 카운트 +1`);
  }
}
