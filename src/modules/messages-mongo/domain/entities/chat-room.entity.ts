export class ChatRoomEntity {
  id: string;
  productId: string;
  participants: {
    userId: string;
    joinedAt: Date;
    leftAt?: Date;
  }[];
  participantsCount: number;
  lastMessage?: string;
  lastMessageId?: string;
  lastMessageAt?: Date;
  relatedOrderId?: string;
  createdAt: Date;
  updatedAt: Date;
}