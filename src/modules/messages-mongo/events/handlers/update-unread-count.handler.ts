import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BaseLocalEventHandler } from '@/events';
import { EventType } from '@/events';
import type { MessageSentEvent } from '@/events';

/**
 * 메시지 발송 후 읽지 않은 메시지 카운트 업데이트 핸들러
 *
 * 책임:
 * - 수신자의 읽지 않은 메시지 카운트 증가
 * - 캐시 업데이트 (Redis)
 */
@Injectable()
export class UpdateUnreadCountHandler extends BaseLocalEventHandler<MessageSentEvent> {
  protected readonly handlerName = 'UpdateUnreadCountHandler';

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
    const { chatRoomId, receiverId } = event.data;

    // TODO: 실제 읽지 않은 메시지 카운트 업데이트 로직 구현
    // 1. Redis에서 현재 카운트 조회
    // 2. 카운트 증가
    // 3. 캐시 업데이트

    this.logger.log(
      `읽지 않은 메시지 카운트 업데이트 완료: ${receiverId}`,
      this.handlerName,
    );

    // 예시: 카운트 업데이트
    console.log(`[카운트 업데이트] 채팅방 ${chatRoomId}의 ${receiverId} 읽지 않은 메시지 +1`);
  }
}
