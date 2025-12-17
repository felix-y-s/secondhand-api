import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ChatRoomRepositoryMongo } from './chat-room.repository.mongo';
import { ChatRoom } from '../schemas';

describe('ChatRoomsRepositoryMongo.findOrCreateChatRoom', () => {
  let repository: ChatRoomRepositoryMongo;

  const mockChatRoom = {
    _id: 'chat-room-123',
    productId: 'product-1',
    participants: [
      { userId: 'user-1', joinedAt: new Date() },
      { userId: 'user-2', joinedAt: new Date() },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  // Mongoose Model Mock (constructor + static methods)
  const mockChatRoomModel: any = jest.fn().mockImplementation(function (this: any) {
    this.save = jest.fn().mockResolvedValue(mockChatRoom);
    return this;
  });
  mockChatRoomModel.find = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatRoomRepositoryMongo,
        {
          provide: getModelToken(ChatRoom.name),
          useValue: mockChatRoomModel,
        },
      ],
    }).compile();

    repository = module.get<ChatRoomRepositoryMongo>(ChatRoomRepositoryMongo);
  });

  it('기존 대화방이 존재하면 첫 번째 결과를 반환한다', async () => {
    const senderId = 'user-1';
    const receiverId = 'user-2';
    const productId = 'product-1';

    (mockChatRoomModel.find as jest.Mock).mockReturnValue({
      exec: jest.fn().mockResolvedValue([mockChatRoom]),
    });

    const result = await repository.findOrCreateChatRoom(
      senderId,
      receiverId,
      productId,
    );

    expect(mockChatRoomModel.find).toHaveBeenCalledWith({
      'participants.userId': { $all: [senderId, receiverId] },
      'participants.productId': productId,
    });
    expect(result).toBe(mockChatRoom);
    expect(mockChatRoomModel).not.toHaveBeenCalled(); // 생성 경로가 아님
  });

  it('기존 대화방이 없으면 새 대화방을 생성하고 저장한다', async () => {
    const senderId = 'user-10';
    const receiverId = 'user-20';
    const productId = 'product-99';

    (mockChatRoomModel.find as jest.Mock).mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });

    const result = await repository.findOrCreateChatRoom(
      senderId,
      receiverId,
      productId,
    );

    expect(mockChatRoomModel.find).toHaveBeenCalledWith({
      'participants.userId': { $all: [senderId, receiverId] },
      'participants.productId': productId,
    });

    // 생성자 호출 검증 (전달된 도큐먼트 구조 및 participants 값 확인)
    expect(mockChatRoomModel).toHaveBeenCalledTimes(1);
    const callArg = (mockChatRoomModel as jest.Mock).mock.calls[0][0];
    expect(callArg).toMatchObject({ productId });
    expect(Array.isArray(callArg.participants)).toBe(true);
    expect(callArg.participants).toHaveLength(2);
    expect(callArg.participants[0]).toMatchObject({ userId: receiverId });
    expect(callArg.participants[1]).toMatchObject({ userId: senderId });

    // save가 호출되어 반환값으로 mockChatRoom을 받았는지 검증
    expect(result).toBe(mockChatRoom);
  });
});
