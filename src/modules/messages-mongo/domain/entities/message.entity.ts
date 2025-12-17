import { MessageType } from '../enums/message-type.enum';

export class MessageEntity {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  messageType: MessageType;
  readAt: Date | null;
  fileUrl: string;
  fileName: string;
  createdAt: Date;
  updatedAt: Date;
}
