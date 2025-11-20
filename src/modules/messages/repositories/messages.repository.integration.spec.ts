import { Test, TestingModule } from '@nestjs/testing';
import { MessageRepository } from './messages.repository';
import { PrismaService } from '@/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

/**
 * MessageRepository 통합 테스트
 *
 * 목적: 실제 PostgreSQL 데이터베이스와 통신하여 Repository 동작 검증
 *
 * 테스트 범위:
 * - findOrCreateChatRoom: 채팅방 생성 및 조회 로직
 * - 실제 User, Product 데이터 생성 및 사용
 * - 트랜잭션 및 관계 데이터 검증
 *
 * 실행 방법:
 * npm run test -- messages.repository.integration.spec.ts
 */
describe('MessageRepository 통합 테스트 (실제 PostgreSQL 연동)', () => {
  let repository: MessageRepository;
  let prisma: PrismaService;
  let moduleRef: TestingModule;

  // 테스트 데이터 ID 저장
  let testUserId: string;
  let testSellerId: string;
  let testProductId: string;
  let createdChatRoomIds: string[] = [];
  let testMessageIds: string[] = [];

  beforeAll(async () => {
    // 테스트 모듈 생성
    moduleRef = await Test.createTestingModule({
      providers: [MessageRepository, PrismaService],
    }).compile();

    repository = moduleRef.get<MessageRepository>(MessageRepository);
    prisma = moduleRef.get<PrismaService>(PrismaService);

    // 테스트 데이터 생성
    await createTestData();
  }, 30000); // 30초 타임아웃

  afterAll(async () => {
    // 테스트 데이터 정리
    await cleanupTestData();

    // 연결 종료
    await prisma.$disconnect();
    await moduleRef.close();
  });

  /**
   * 테스트 데이터 생성
   * - 구매자 (testUserId)
   * - 판매자 (testSellerId)
   * - 상품 (testProductId)
   */
  async function createTestData() {
    // 1. 구매자 생성
    const buyer = await prisma.user.create({
      data: {
        email: `buyer-${Date.now()}@test.com`,
        password: 'hashedPassword123',
        nickname: '테스트구매자',
        phoneNumber: '01012345678',
      },
    });
    testUserId = buyer.id;

    // 2. 판매자 생성
    const seller = await prisma.user.create({
      data: {
        email: `seller-${Date.now()}@test.com`,
        password: 'hashedPassword123',
        nickname: '테스트판매자',
        phoneNumber: '01087654321',
      },
    });
    testSellerId = seller.id;

    // 3. 카테고리 생성 (Product는 categoryId 필수)
    const timestamp = Date.now();
    const category = await prisma.category.create({
      data: {
        name: `테스트카테고리-${timestamp}`,
        slug: `test-category-${timestamp}`,
      },
    });

    // 4. 상품 생성
    const product = await prisma.product.create({
      data: {
        title: '테스트 상품',
        description: '통합 테스트용 상품',
        price: 50000,
        condition: 'GOOD',
        sellerId: testSellerId,
        categoryId: category.id,
        status: 'ACTIVE',
      },
    });
    testProductId = product.id;
  }

  /**
   * 테스트 데이터 정리
   */
  async function cleanupTestData() {
    // 1. 채팅방 삭제 (Cascade로 ChatRoomMember, ChatMessage도 삭제됨)
    if (createdChatRoomIds.length > 0) {
      await prisma.chatRoom.deleteMany({
        where: { id: { in: createdChatRoomIds } },
      });
    }

    // 2. 상품 삭제
    if (testProductId) {
      await prisma.product
        .delete({ where: { id: testProductId } })
        .catch(() => {});
    }

    // 3. 사용자 삭제
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
    if (testSellerId) {
      await prisma.user.delete({ where: { id: testSellerId } }).catch(() => {});
    }

    // 4. 메시지 삭제 (채팅방 삭제 시 Cascade로 자동 삭제되므로 별도 처리 불필요)
  }

  /**
   * 테스트 케이스: 새 채팅방 생성
   */
  describe('findOrCreateChatRoom - 새 채팅방 생성', () => {
    it('구매자가 상품에 대해 처음 채팅방을 생성할 수 있어야 함', async () => {
      // When: 채팅방 생성
      const result = await repository.findOrCreateChatRoom(
        testUserId,
        testProductId,
      );

      // 생성된 채팅방 ID 저장 (cleanup용)
      createdChatRoomIds.push(result.room.id);

      // Then: 검증
      expect(result.isNew).toBe(true); // 새 채팅방
      expect(result.room).toBeDefined();
      expect(result.room.productId).toBe(testProductId);
      expect(result.room.members).toHaveLength(2); // 구매자 + 판매자

      // 멤버 확인
      const memberIds = result.room.members.map((m) => m.userId).sort();
      expect(memberIds).toEqual([testUserId, testSellerId].sort());

      // User 정보 포함 확인 (include 동작 검증)
      result.room.members.forEach((member) => {
        expect(member.user).toBeDefined();
        expect(member.user.id).toBeDefined();
        expect(member.user.nickname).toBeDefined();
        expect(member.user.profileImage).toBeDefined();
      });
    });

    it('생성된 채팅방에 구매자와 판매자 정보가 정확히 포함되어야 함', async () => {
      // When: 새 채팅방 생성
      const result = await repository.findOrCreateChatRoom(
        testUserId,
        testProductId,
      );
      createdChatRoomIds.push(result.room.id);

      // Then: 구매자 정보 확인
      const buyer = result.room.members.find((m) => m.userId === testUserId);
      expect(buyer).toBeDefined();
      expect(buyer!.user.nickname).toBe('테스트구매자');

      // 판매자 정보 확인
      const seller = result.room.members.find((m) => m.userId === testSellerId);
      expect(seller).toBeDefined();
      expect(seller!.user.nickname).toBe('테스트판매자');
    });
  });

  /**
   * 테스트 케이스: 기존 채팅방 조회
   */
  describe('findOrCreateChatRoom - 기존 채팅방 조회', () => {
    let existingChatRoomId: string;

    beforeEach(async () => {
      // Given: 기존 채팅방 생성
      const result = await repository.findOrCreateChatRoom(
        testUserId,
        testProductId,
      );
      existingChatRoomId = result.room.id;
      createdChatRoomIds.push(existingChatRoomId);
    });

    it('동일한 구매자와 상품으로 다시 호출하면 기존 채팅방을 반환해야 함', async () => {
      // When: 동일한 파라미터로 재호출
      const result = await repository.findOrCreateChatRoom(
        testUserId,
        testProductId,
      );

      // Then: 기존 채팅방 반환
      expect(result.isNew).toBe(false); // 기존 채팅방
      expect(result.room.id).toBe(existingChatRoomId);
      expect(result.room.members).toHaveLength(2);
    });

    it('기존 채팅방 조회 시에도 User 정보가 포함되어야 함', async () => {
      // When: 기존 채팅방 조회
      const result = await repository.findOrCreateChatRoom(
        testUserId,
        testProductId,
      );

      // Then: User 정보 검증
      result.room.members.forEach((member) => {
        expect(member.user).toBeDefined();
        expect(member.user.id).toBeDefined();
        expect(member.user.nickname).toBeDefined();
      });
    });
  });

  /**
   * 테스트 케이스: 에러 처리
   */
  describe('findOrCreateChatRoom - 에러 처리', () => {
    it('존재하지 않는 상품 ID로 호출 시 NotFoundException을 던져야 함', async () => {
      // Given: 존재하지 않는 상품 ID
      const nonExistentProductId = '99999999-9999-9999-9999-999999999999';

      // When & Then: NotFoundException 발생
      await expect(
        repository.findOrCreateChatRoom(testUserId, nonExistentProductId),
      ).rejects.toThrow(NotFoundException);

      await expect(
        repository.findOrCreateChatRoom(testUserId, nonExistentProductId),
      ).rejects.toThrow('상품을 찾을 수 없습니다.');
    });
  });

  /**
   * 테스트 케이스: 트랜잭션 및 동시성 검증
   */
  describe('findOrCreateChatRoom - 트랜잭션 및 동시성 검증', () => {
    it('동시에 여러 요청이 와도 채팅방은 1개만 생성되어야 함 (동시성 제어)', async () => {
      // Given: 동일한 파라미터로 10번 동시 호출
      const promises = Array.from({ length: 10 }, () =>
        repository.findOrCreateChatRoom(testUserId, testProductId),
      );

      // When: 병렬 실행
      const results = await Promise.all(promises);

      // Then: 모든 결과가 동일한 채팅방 ID를 가져야 함
      const uniqueChatRoomIds = new Set(results.map((r) => r.room.id));
      expect(uniqueChatRoomIds.size).toBe(1); // 채팅방 1개만 생성

      // 생성된 채팅방 ID 저장 (cleanup용)
      createdChatRoomIds.push(results[0].room.id);

      // 데이터베이스에서 직접 확인
      const chatRooms = await prisma.chatRoom.findMany({
        where: {
          productId: testProductId,
          members: {
            some: { userId: testUserId },
          },
        },
      });

      expect(chatRooms).toHaveLength(1); // DB에도 1개만 존재
    });

    it('채팅방과 멤버가 트랜잭션으로 생성되어야 함 (원자성)', async () => {
      // When: 채팅방 생성
      const result = await repository.findOrCreateChatRoom(
        testUserId,
        testProductId,
      );
      createdChatRoomIds.push(result.room.id);

      // Then: 데이터베이스에서 직접 확인
      const chatRoom = await prisma.chatRoom.findUnique({
        where: { id: result.room.id },
        include: { members: true },
      });

      expect(chatRoom).toBeDefined();
      expect(chatRoom!.members).toHaveLength(2);

      // 중요: 멤버가 모두 동일한 트랜잭션에서 생성되었는지 확인
      // (생성 시간이 거의 동일해야 함 - 밀리초 단위 차이)
      const joinedAtDiff = Math.abs(
        chatRoom!.members[0].joinedAt.getTime() -
          chatRoom!.members[1].joinedAt.getTime(),
      );
      expect(joinedAtDiff).toBeLessThan(1000); // 1초 이내 차이
    });

    it('chatRoomId FK가 올바르게 설정되어야 함', async () => {
      // When: 채팅방 생성
      const result = await repository.findOrCreateChatRoom(
        testUserId,
        testProductId,
      );
      createdChatRoomIds.push(result.room.id);

      // Then: 멤버의 chatRoomId 확인
      result.room.members.forEach((member) => {
        expect(member.chatRoomId).toBe(result.room.id);
      });
    });

    it('트랜잭션 실패 시 전체 롤백되어야 함 (중복 방지)', async () => {
      // Given: 이미 존재하는 채팅방 생성
      const firstResult = await repository.findOrCreateChatRoom(
        testUserId,
        testProductId,
      );
      createdChatRoomIds.push(firstResult.room.id);

      // When: 동일한 요청 재시도
      const secondResult = await repository.findOrCreateChatRoom(
        testUserId,
        testProductId,
      );

      // Then: 새 채팅방이 생성되지 않고 기존 채팅방 반환
      expect(secondResult.isNew).toBe(false);
      expect(secondResult.room.id).toBe(firstResult.room.id);

      // 데이터베이스 확인: 채팅방 1개만 존재
      const chatRooms = await prisma.chatRoom.findMany({
        where: {
          productId: testProductId,
          members: {
            some: { userId: testUserId },
          },
        },
      });

      expect(chatRooms).toHaveLength(1);
    });
  });

  /**
   * 테스트 케이스: 메시지 전송
   */
  describe('createMessage - 메시지 저장', () => {
    let existingChatRoomId: string;
    beforeEach(async () => {
      // Given: 기존 채팅방 생성
      const result = await repository.findOrCreateChatRoom(
        testUserId,
        testProductId,
      );
      existingChatRoomId = result.room.id;
      createdChatRoomIds.push(existingChatRoomId);
    });

    it('텍스트 메시지를 저장할 수 있어야 함', async () => {
      // When: 텍스트 메시지 생성
      const savedMessage = await repository.createMessage(
        testUserId,
        existingChatRoomId,
        '안녕하세요, 상품 구매 가능한가요?',
      );

      // Then: 메시지 검증
      expect(savedMessage.chatRoomId).toBe(existingChatRoomId);
      expect(savedMessage.senderId).toBe(testUserId);
      expect(savedMessage.content).toBe('안녕하세요, 상품 구매 가능한가요?');
      expect(savedMessage.messageType).toBe('TEXT');
      expect(savedMessage.fileUrl).toBeNull();
      expect(savedMessage.fileName).toBeNull();
      expect(savedMessage.sender).toBeDefined();
      expect(savedMessage.sender.id).toBe(testUserId);
      expect(savedMessage.sender.nickname).toBe('테스트구매자');
    });

    it('파일 메시지를 저장할 수 있어야 함', async () => {
      // When: 이미지 파일 메시지 생성
      const savedMessage = await repository.createMessage(
        testUserId,
        existingChatRoomId,
        '상품 사진입니다',
        'IMAGE',
        'https://example.com/images/product.jpg',
        'product.jpg',
      );

      // Then: 파일 정보 검증
      expect(savedMessage.messageType).toBe('IMAGE');
      expect(savedMessage.fileUrl).toBe(
        'https://example.com/images/product.jpg',
      );
      expect(savedMessage.fileName).toBe('product.jpg');
      expect(savedMessage.content).toBe('상품 사진입니다');
    });

    it('존재하지 않는 대화방으로 메시지 전송 시 에러를 던져야 함', async () => {
      // Given: 존재하지 않는 채팅방 ID
      const nonExistentChatRoomId = '99999999-9999-9999-9999-999999999999';

      // When & Then: Foreign Key 제약으로 인한 에러 발생
      await expect(
        repository.createMessage(
          testUserId,
          nonExistentChatRoomId,
          '없는 대화방으로 전송',
        ),
      ).rejects.toThrow();
    });
  });

  describe('채팅방 목록 조회', () => {
    let existingChatRoomId;
    beforeAll(async () => {
      // Given: 기존 채팅방 생성
      const result = await repository.findOrCreateChatRoom(
        testUserId,
        testProductId,
      );
      existingChatRoomId = result.room.id;
      createdChatRoomIds.push(existingChatRoomId);
    });
    it('채팅방 목록 조회', async () => {
      const result = await repository.findChatRoomsByUserId(testUserId);

      expect(result[0].user.id).toBe(testUserId);
    });
  });

  describe('메시지 히스토리 조회', () => {
    const messageCount = 100;
    let existingChatRoomId;
    beforeAll(async () => {
      // 대화방 만들고
      const result = await repository.findOrCreateChatRoom(
        testUserId,
        testProductId,
      );
      existingChatRoomId = result.room.id;
      createdChatRoomIds.push(existingChatRoomId);

      // 메시지 추가(순서 보장)
      for (let index = 0; index < messageCount; index++) {
        await repository.createMessage(
          testUserId,
          existingChatRoomId,
          `테스트 메시지-${index}`,
        );
      }

      
    });
    it('최신 메시지 조회', async () => {
      const page = 1;
      const limit = 10;
      const result = await repository.findMessagesByRoomId(
        existingChatRoomId,
        page,
        limit,
      );
      expect(result.total).toBe(messageCount);
      expect(result.page).toBe(page);
      expect(result.limit).toBe(limit);
      expect(result.totalPages).toBe(Math.ceil(result.total / limit));
    });
  });

  describe('채팅방 상세 조회', () => {
    let existingChatRoomId;
    beforeAll(async () => {
      // 대화방 만들고
      const result = await repository.findOrCreateChatRoom(
        testUserId,
        testProductId,
      );
      existingChatRoomId = result.room.id;
      createdChatRoomIds.push(existingChatRoomId);
    }),
    it('💬 채팅방 상세 조회', async () => {
      const result = await repository.findChatRoomById(existingChatRoomId);
      console.log('🚀 | result:', result);

      expect(result?.id).toBe(existingChatRoomId);
    })
  })

  describe('채팅방 나가기', () => {
    let chatRoomId;
    beforeAll(async () => {
      const result = await repository.findOrCreateChatRoom(
        testUserId, testProductId
      )
      chatRoomId = result.room.id;
      createdChatRoomIds.push(chatRoomId);
    })

    it('채팅방 나가기', async () => {
      const roomInfo1 = await repository.findChatRoomById(chatRoomId);
      expect(roomInfo1?.members.length).toBe(2);

      await repository.leaveChatRoom(chatRoomId, testUserId);

      const roomInfo2 = await repository.findChatRoomById(chatRoomId);
      expect(roomInfo2?.members.length).toBe(1);
    })

    it('채팅방 나가기: 모두 나가면 채팅방 삭제', async () => {
      // room이 존재 해야 함.
      const room1 = await repository.findChatRoomById(chatRoomId);
      expect(room1?.id).toBe(chatRoomId);

      await repository.leaveChatRoom(chatRoomId, testUserId);
      await repository.leaveChatRoom(chatRoomId, testSellerId);

      // 모두 나간 대화방 삭제 확인
      const room2 = await repository.findChatRoomById(chatRoomId);
      expect(room2).toBeNull();
      
    }) 
  })
});
