import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BaseLocalEventHandler } from '@/events';
import { EventType } from '@/events';
import type { MessageSentEvent } from '@/events';

/**
 * 메시지 발송 후 알림 전송 핸들러
 *
 * 책임:
 * - 수신자에게 푸시 알림 전송
 * - 이메일/SMS 알림 전송 (옵션)
 */
@Injectable()
export class SendMessageNotificationHandler extends BaseLocalEventHandler<MessageSentEvent> {
  protected readonly handlerName = 'SendMessageNotificationHandler';

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
    const { receiverId, senderId, message } = event.data;

    // TODO: 실제 알림 전송 로직 구현
    // 1. 수신자가 온라인인지 확인
    // 2. 오프라인이면 푸시 알림 전송
    // 3. 설정에 따라 이메일/SMS 알림 전송

    this.logger.log(
      `메시지 알림 전송 완료: ${senderId} → ${receiverId}`,
      this.handlerName,
    );

    // 예시: 푸시 알림 전송
    console.log(`[푸시 알림] ${receiverId}에게 새 메시지: ${message.substring(0, 20)}...`);
  }
}
