import { Test, TestingModule } from '@nestjs/testing';
import { MongodbService } from './mongodb.service';
import { getModelToken } from '@nestjs/mongoose';
import { ProductDetail } from './schemas/product-detail.schema';
import { Message } from './schemas/message.schema';

describe('MongodbService', () => {
  let service: MongodbService;

  const mockProductDetail = {
    productId: 1,
    description: '테스트 상품 설명',
    images: [
      { url: 'https://example.com/image1.jpg', alt: '이미지 1', order: 1 },
    ],
    specifications: {
      brand: '테스트 브랜드',
      condition: '새상품',
      location: {
        city: '서울',
        district: '강남구',
        coordinates: [37.5665, 126.9780],
      },
    },
    save: jest.fn().mockResolvedValue(this),
  };

  const mockMessage = {
    conversationId: 'conv-123',
    senderId: 1,
    receiverId: 2,
    message: '안녕하세요!',
    messageType: 'text',
    save: jest.fn().mockResolvedValue(this),
  };

  // Model을 함수로 모킹 (생성자 역할)
  const mockProductDetailModel: any = jest.fn().mockImplementation(() => ({
    save: jest.fn().mockResolvedValue(mockProductDetail),
  }));
  mockProductDetailModel.findOne = jest.fn();
  mockProductDetailModel.find = jest.fn();
  mockProductDetailModel.findOneAndUpdate = jest.fn();
  mockProductDetailModel.findOneAndDelete = jest.fn();

  const mockMessageModel: any = jest.fn().mockImplementation(() => ({
    save: jest.fn().mockResolvedValue(mockMessage),
  }));
  mockMessageModel.find = jest.fn();
  mockMessageModel.findByIdAndUpdate = jest.fn();
  mockMessageModel.findByIdAndDelete = jest.fn();
  mockMessageModel.deleteMany = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MongodbService,
        {
          provide: getModelToken(ProductDetail.name),
          useValue: mockProductDetailModel,
        },
        {
          provide: getModelToken(Message.name),
          useValue: mockMessageModel,
        },
      ],
    }).compile();

    service = module.get<MongodbService>(MongodbService);
  });

  it('서비스가 정의되어야 함', () => {
    expect(service).toBeDefined();
  });

  describe('ProductDetail CRUD', () => {
    describe('createProductDetail', () => {
      it('상품 상세 정보를 생성해야 함', async () => {
        const createDto = {
          productId: 1,
          description: '테스트 상품',
          images: [{ url: 'test.jpg', alt: '테스트', order: 1 }],
        };

        await service.createProductDetail(createDto);

        expect(mockProductDetailModel).toHaveBeenCalledWith(createDto);
      });
    });

    describe('getProductDetail', () => {
      it('productId로 상품 상세 정보를 조회해야 함', async () => {
        const productId = 1;
        const execMock = jest.fn().mockResolvedValue(mockProductDetail);

        mockProductDetailModel.findOne.mockReturnValue({ exec: execMock });

        const result = await service.getProductDetail(productId);

        expect(mockProductDetailModel.findOne).toHaveBeenCalledWith({
          productId,
        });
        expect(execMock).toHaveBeenCalled();
      });
    });

    describe('getAllProductDetails', () => {
      it('모든 상품 상세 정보를 조회해야 함', async () => {
        const mockProducts = [mockProductDetail];
        const execMock = jest.fn().mockResolvedValue(mockProducts);

        mockProductDetailModel.find.mockReturnValue({ exec: execMock });

        const result = await service.getAllProductDetails();

        expect(mockProductDetailModel.find).toHaveBeenCalled();
        expect(execMock).toHaveBeenCalled();
      });
    });

    describe('updateProductDetail', () => {
      it('상품 상세 정보를 업데이트해야 함', async () => {
        const productId = 1;
        const updateData = { description: '업데이트된 설명' };
        const execMock = jest.fn().mockResolvedValue({
          ...mockProductDetail,
          ...updateData,
        });

        mockProductDetailModel.findOneAndUpdate.mockReturnValue({
          exec: execMock,
        });

        const result = await service.updateProductDetail(productId, updateData);

        expect(mockProductDetailModel.findOneAndUpdate).toHaveBeenCalledWith(
          { productId },
          updateData,
          { new: true },
        );
        expect(execMock).toHaveBeenCalled();
      });
    });

    describe('deleteProductDetail', () => {
      it('상품 상세 정보를 삭제해야 함', async () => {
        const productId = 1;
        const execMock = jest.fn().mockResolvedValue(mockProductDetail);

        mockProductDetailModel.findOneAndDelete.mockReturnValue({
          exec: execMock,
        });

        const result = await service.deleteProductDetail(productId);

        expect(mockProductDetailModel.findOneAndDelete).toHaveBeenCalledWith({
          productId,
        });
        expect(execMock).toHaveBeenCalled();
      });
    });
  });

  describe('Message CRUD', () => {
    describe('createMessage', () => {
      it('메시지를 생성해야 함', async () => {
        const createDto = {
          conversationId: 'conv-123',
          senderId: 1,
          receiverId: 2,
          message: '안녕하세요',
        };

        await service.createMessage(createDto);

        expect(mockMessageModel).toHaveBeenCalledWith(createDto);
      });
    });

    describe('getMessagesByConversation', () => {
      it('대화방의 모든 메시지를 조회해야 함', async () => {
        const conversationId = 'conv-123';
        const mockMessages = [mockMessage];
        const execMock = jest.fn().mockResolvedValue(mockMessages);

        mockMessageModel.find.mockReturnValue({
          sort: jest.fn().mockReturnValue({ exec: execMock }),
        });

        const result = await service.getMessagesByConversation(conversationId);

        expect(mockMessageModel.find).toHaveBeenCalledWith({
          conversationId,
        });
      });
    });

    describe('getUnreadMessages', () => {
      it('읽지 않은 메시지를 조회해야 함', async () => {
        const receiverId = 2;
        const mockMessages = [mockMessage];
        const execMock = jest.fn().mockResolvedValue(mockMessages);

        mockMessageModel.find.mockReturnValue({
          sort: jest.fn().mockReturnValue({ exec: execMock }),
        });

        const result = await service.getUnreadMessages(receiverId);

        expect(mockMessageModel.find).toHaveBeenCalledWith({
          receiverId,
          readAt: null,
        });
      });
    });

    describe('markMessageAsRead', () => {
      it('메시지를 읽음 처리해야 함', async () => {
        const messageId = 'msg-123';
        const execMock = jest.fn().mockResolvedValue({
          ...mockMessage,
          readAt: new Date(),
        });

        mockMessageModel.findByIdAndUpdate.mockReturnValue({
          exec: execMock,
        });

        const result = await service.markMessageAsRead(messageId);

        expect(mockMessageModel.findByIdAndUpdate).toHaveBeenCalledWith(
          messageId,
          expect.objectContaining({ readAt: expect.any(Date) }),
          { new: true },
        );
      });
    });

    describe('deleteMessage', () => {
      it('메시지를 삭제해야 함', async () => {
        const messageId = 'msg-123';
        const execMock = jest.fn().mockResolvedValue(mockMessage);

        mockMessageModel.findByIdAndDelete.mockReturnValue({
          exec: execMock,
        });

        const result = await service.deleteMessage(messageId);

        expect(mockMessageModel.findByIdAndDelete).toHaveBeenCalledWith(
          messageId,
        );
      });
    });

    describe('deleteConversation', () => {
      it('대화방의 모든 메시지를 삭제해야 함', async () => {
        const conversationId = 'conv-123';
        const execMock = jest
          .fn()
          .mockResolvedValue({ deletedCount: 5 });

        mockMessageModel.deleteMany.mockReturnValue({ exec: execMock });

        const result = await service.deleteConversation(conversationId);

        expect(mockMessageModel.deleteMany).toHaveBeenCalledWith({
          conversationId,
        });
      });
    });
  });
});
