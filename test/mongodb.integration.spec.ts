import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { MongodbService } from '../src/database/mongodb/mongodb.service';
import {
  ProductDetail,
  ProductDetailSchema,
} from '../src/database/mongodb/schemas/product-detail.schema';
import {
  Message,
  MessageSchema,
} from '../src/database/mongodb/schemas/message.schema';

describe('MongodbService 통합 테스트 (실제 DB 연동)', () => {
  let service: MongodbService;
  let moduleRef: TestingModule;

  // 테스트용 데이터 ID
  const testProductId = 999999;
  const testConversationId = 'test-conversation-' + Date.now();
  const testUserId = 888888;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        // 실제 MongoDB에 연결
        MongooseModule.forRoot('mongodb://localhost:27017/secondhand'),
        MongooseModule.forFeature([
          { name: ProductDetail.name, schema: ProductDetailSchema },
          { name: Message.name, schema: MessageSchema },
        ]),
      ],
      providers: [MongodbService],
    }).compile();

    service = moduleRef.get<MongodbService>(MongodbService);
  }, 30000); // 30초 타임아웃

  afterAll(async () => {
    // 테스트 데이터 정리
    if (service) {
      await service.deleteProductDetail(testProductId);
      await service.deleteConversation(testConversationId);
    }
    await moduleRef.close();
  });

  describe('ProductDetail CRUD 통합 테스트', () => {
    it('상품 상세 정보를 생성하고 조회할 수 있어야 함', async () => {
      // 생성
      const productData = {
        productId: testProductId,
        description: '테스트 상품 상세 설명입니다.',
        specifications: {
          brand: '테스트 브랜드',
          condition: '중고 - 상',
          location: {
            city: '서울',
            district: '강남구',
            coordinates: [127.0276, 37.4979] as [number, number],
          },
        },
        images: [
          { url: 'https://example.com/image1.jpg', alt: '이미지1', order: 1 },
          { url: 'https://example.com/image2.jpg', alt: '이미지2', order: 2 },
        ],
      };

      const created = await service.createProductDetail(productData);
      expect(created).toBeDefined();
      expect(created.productId).toBe(testProductId);
      expect(created.description).toBe('테스트 상품 상세 설명입니다.');

      // 조회
      const found = await service.getProductDetail(testProductId);
      expect(found).toBeDefined();
      expect(found!.productId).toBe(testProductId);
      expect(found!.specifications?.brand).toBe('테스트 브랜드');
      expect(found!.images).toHaveLength(2);
    });

    it('상품 상세 정보를 업데이트할 수 있어야 함', async () => {
      const updateData = {
        description: '업데이트된 상세 설명',
        specifications: {
          brand: '업데이트 브랜드',
          condition: '중고 - 최상',
        },
      };

      const updated = await service.updateProductDetail(
        testProductId,
        updateData,
      );
      expect(updated).toBeDefined();
      expect(updated!.description).toBe('업데이트된 상세 설명');
      expect(updated!.specifications?.brand).toBe('업데이트 브랜드');
      expect(updated!.specifications?.condition).toBe('중고 - 최상');
    });

    it('모든 상품 상세 정보를 조회할 수 있어야 함', async () => {
      const allProducts = await service.getAllProductDetails();
      expect(Array.isArray(allProducts)).toBe(true);
      expect(allProducts.length).toBeGreaterThanOrEqual(1);

      const testProduct = allProducts.find((p) => p.productId === testProductId);
      expect(testProduct).toBeDefined();
    });

    it('상품 상세 정보를 삭제할 수 있어야 함', async () => {
      const deleted = await service.deleteProductDetail(testProductId);
      expect(deleted).toBeDefined();
      expect(deleted!.productId).toBe(testProductId);

      // 삭제 확인
      const found = await service.getProductDetail(testProductId);
      expect(found).toBeNull();
    });
  });

  describe('Message CRUD 통합 테스트', () => {
    let createdMessageId: string;

    it('메시지를 생성하고 조회할 수 있어야 함', async () => {
      // 메시지 생성
      const messageData = {
        conversationId: testConversationId,
        senderId: testUserId,
        receiverId: testUserId + 1,
        message: '안녕하세요! 테스트 메시지입니다.',
        messageType: 'text' as const,
      };

      const created = await service.createMessage(messageData);
      expect(created).toBeDefined();
      expect(created.conversationId).toBe(testConversationId);
      expect(created.message).toBe('안녕하세요! 테스트 메시지입니다.');
      expect(created.readAt).toBeUndefined();

      createdMessageId = created._id.toString();

      // 대화방별 메시지 조회
      const messages =
        await service.getMessagesByConversation(testConversationId);
      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBeGreaterThanOrEqual(1);
      expect(messages[0].conversationId).toBe(testConversationId);
    });

    it('읽지 않은 메시지를 조회할 수 있어야 함', async () => {
      const unreadMessages = await service.getUnreadMessages(testUserId + 1);
      expect(Array.isArray(unreadMessages)).toBe(true);
      expect(unreadMessages.length).toBeGreaterThanOrEqual(1);

      const testMessage = unreadMessages.find(
        (m) => m.conversationId === testConversationId,
      );
      expect(testMessage).toBeDefined();
      expect(testMessage!.readAt).toBeUndefined();
    });

    it('메시지를 읽음 처리할 수 있어야 함', async () => {
      const marked = await service.markMessageAsRead(createdMessageId);
      expect(marked).toBeDefined();
      expect(marked!.readAt).toBeDefined();
      expect(marked!.readAt).toBeInstanceOf(Date);

      // 읽음 처리 확인
      const messages =
        await service.getMessagesByConversation(testConversationId);
      const readMessage = messages.find(
        (m) => m._id.toString() === createdMessageId,
      );
      expect(readMessage).toBeDefined();
      expect(readMessage!.readAt).toBeDefined();
    });

    it('개별 메시지를 삭제할 수 있어야 함', async () => {
      // 추가 메시지 생성
      const additionalMessage = await service.createMessage({
        conversationId: testConversationId,
        senderId: testUserId,
        receiverId: testUserId + 1,
        message: '삭제될 메시지',
        messageType: 'text' as const,
      });

      const additionalMessageId = additionalMessage._id.toString();

      // 메시지 삭제
      const deleted = await service.deleteMessage(additionalMessageId);
      expect(deleted).toBeDefined();

      // 삭제 확인
      const messages =
        await service.getMessagesByConversation(testConversationId);
      const deletedMessage = messages.find(
        (m) => m._id.toString() === additionalMessageId,
      );
      expect(deletedMessage).toBeUndefined();
    });

    it('대화방의 모든 메시지를 삭제할 수 있어야 함', async () => {
      const result = await service.deleteConversation(testConversationId);
      expect(result.deletedCount).toBeGreaterThanOrEqual(1);

      // 삭제 확인
      const messages =
        await service.getMessagesByConversation(testConversationId);
      expect(messages).toHaveLength(0);
    });
  });
});
