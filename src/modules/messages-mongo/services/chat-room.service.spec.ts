import { ChatRoomService } from './chat-room.service';
import { ChatRoomRepositoryMongo } from '../repositories/chat-room.repository.mongo';
import { UsersService } from '@/modules/users/users.service';
import { ProductsService } from '@/modules/products/products.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChatRoomEntity } from '../domain/entities/chat-room.entity';

/**
 * ChatRoomService 단위 테스트
 *
 * 테스트 대상: ensureUserCanAccessChatRoom() - 핵심 권한 검증 로직
 * 테스트 전략: 핵심 비즈니스 로직만 집중 테스트 (4개)
 */
describe('ChatRoomService', () => {
  let service: ChatRoomService;
  let mockRepository: jest.Mocked<ChatRoomRepositoryMongo>;
  let mockUsersService: jest.Mocked<UsersService>;
  let mockProductsService: jest.Mocked<ProductsService>;

  beforeEach(() => {
    // Mock 객체 생성
    mockRepository = {
      findChatRoomById: jest.fn(),
    } as any;

    mockUsersService = {} as any;
    mockProductsService = {} as any;

    // 서비스 인스턴스 생성
    service = new ChatRoomService(
      mockRepository,
      mockUsersService,
      mockProductsService,
    );
  });

  describe('ensureUserCanAccessChatRoom()', () => {
    const chatRoomId = 'chatroom-123';
    const userId = 'user-123';
    const now = new Date();

    it('대화방이 존재하지 않으면 NotFoundException을 던져야 한다', async () => {
      // Given: repository가 null 반환
      mockRepository.findChatRoomById.mockResolvedValue(null);

      // When & Then: NotFoundException 발생
      await expect(
        service.ensureUserCanAccessChatRoom(chatRoomId, userId),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.ensureUserCanAccessChatRoom(chatRoomId, userId),
      ).rejects.toThrow('대화방을 찾을 수 없습니다');
    });

    it('참가자가 아니면 ForbiddenException을 던져야 한다', async () => {
      // Given: 다른 사용자들만 있는 대화방
      const chatRoom: ChatRoomEntity = {
        id: chatRoomId,
        productId: 'product-123',
        participants: [
          { userId: 'other-user-1', joinedAt: now, leftAt: null as any },
          { userId: 'other-user-2', joinedAt: now, leftAt: null as any },
        ],
        participantsCount: 2,
        createdAt: now,
        updatedAt: now,
      };

      mockRepository.findChatRoomById.mockResolvedValue(chatRoom);

      // When & Then: ForbiddenException 발생
      await expect(
        service.ensureUserCanAccessChatRoom(chatRoomId, userId),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.ensureUserCanAccessChatRoom(chatRoomId, userId),
      ).rejects.toThrow('권한이 없습니다');
    });

    it('참가자이지만 나간 사용자(leftAt 설정됨)면 ForbiddenException을 던져야 한다', async () => {
      // Given: leftAt이 설정된 참가자
      const leftDate = new Date('2024-01-01');
      const chatRoom: ChatRoomEntity = {
        id: chatRoomId,
        productId: 'product-123',
        participants: [
          { userId: userId, joinedAt: now, leftAt: leftDate }, // 나간 사용자
          { userId: 'other-user', joinedAt: now, leftAt: null as any },
        ],
        participantsCount: 1,
        createdAt: now,
        updatedAt: now,
      };

      mockRepository.findChatRoomById.mockResolvedValue(chatRoom);

      // When & Then: ForbiddenException 발생
      await expect(
        service.ensureUserCanAccessChatRoom(chatRoomId, userId),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.ensureUserCanAccessChatRoom(chatRoomId, userId),
      ).rejects.toThrow('권한이 없습니다');
    });

    it('정상 참가자는 대화방에 접근할 수 있어야 한다', async () => {
      // Given: userId와 일치하고 leftAt이 null인 참가자
      const chatRoom: ChatRoomEntity = {
        id: chatRoomId,
        productId: 'product-123',
        participants: [
          { userId: userId, joinedAt: now, leftAt: null as any }, // 현재 사용자
          { userId: 'other-user', joinedAt: now, leftAt: null as any },
        ],
        participantsCount: 2,
        createdAt: now,
        updatedAt: now,
      };

      mockRepository.findChatRoomById.mockResolvedValue(chatRoom);

      // When: 접근 시도
      const result = await service.ensureUserCanAccessChatRoom(
        chatRoomId,
        userId,
      );

      // Then: 대화방 반환
      expect(result).toBe(chatRoom);
      expect(result.id).toBe(chatRoomId);
    });
  });
});
