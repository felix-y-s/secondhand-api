import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class MessageListener {
  constructor() {}

  /**
   * 수신자에게 알림 생성
   * @param payload
   */
  @OnEvent('message.sent')
  async handleMessageSent(payload: {
    messageId: string;
    chatRoomId: string;
    senderId: string;
    receiverId: string;
    content: string;
  }) {
    // TODO: 수신자에게 알림 생성
    console.log('🚀 | MessageListener | handleMessageSent | payload:', payload);
  }

  /**
   * 판매자에게 알림 생성
   */
  @OnEvent('chatroom.created')
  async handleChatRoomCreated(payload: {
    chatRoomId: string;
    productId: string;
    buyerId: string;
    sellerId: string;
  }) {
    // TODO: 판매자에게 알림 생성
    console.log(
      '🚀 | MessageListener | handleChatRoomCreated | payload:',
      payload,
    );
  }
}