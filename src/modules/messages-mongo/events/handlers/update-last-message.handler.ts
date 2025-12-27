import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BaseLocalEventHandler } from '@/events';
import { EventType } from '@/events';
import type { MessageSentEvent } from '@/events';
import { ChatRoomService } from '../../services/chat-room.service';

/**
 * 메시지 발송 후 마지막 메시지 업데이트 핸들러
 *
 * 책임:
 * - 채팅방의 마지막 메시지 정보 업데이트
 */
@Injectable()
export class UpdateLastMessageHandler extends BaseLocalEventHandler<MessageSentEvent> {
  protected readonly handlerName = 'UpdateLastMessageHandler';

  constructor(private readonly chatRoomService: ChatRoomService) {
    super();
  }

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
    const { chatRoomId, messageId, message } = event.data;

    await this.chatRoomService.updateLastMessage(chatRoomId, {
      lastMessage: message,
      lastMessageId: messageId,
    });

    this.logger.log(
      `채팅방 마지막 메시지 업데이트 완료: ${chatRoomId}`,
      this.handlerName,
    );
  }
}
