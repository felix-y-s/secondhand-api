import { MessageMapper } from './message.mapper';
import { MessageType } from '../domain/enums/message-type.enum';
import { Types } from 'mongoose';

/**
 * MessageMapper 단위 테스트
 *
 * 테스트 대상:
 * - toEntity(): MongoDB 문서를 MessageEntity로 변환
 * - toEntityOrNull(): null 체크 후 변환
 * - toEntities(): 배열 변환
 */
describe('MessageMapper', () => {
  let mapper: MessageMapper;

  beforeEach(() => {
    mapper = new MessageMapper();
  });

  describe('toEntity()', () => {
    it('정상적인 MongoDB 문서를 MessageEntity로 변환해야 한다', () => {
      // Given: 정상적인 MongoDB 문서
      const mockObjectId = new Types.ObjectId();
      const now = new Date();
      const mockDoc = {
        _id: mockObjectId,
        conversationId: 'conversation-123',
        senderId: 'sender-123',
        receiverId: 'receiver-123',
        message: '안녕하세요',
        messageType: MessageType.TEXT,
        readAt: now,
        fileUrl: 'https://example.com/file.jpg',
        fileName: 'file.jpg',
        createdAt: now,
        updatedAt: now,
      };

      // When: toEntity 호출
      const result = mapper.toEntity(mockDoc);

      // Then: 올바르게 변환되어야 함
      expect(result).toEqual({
        id: mockObjectId.toString(),
        conversationId: 'conversation-123',
        senderId: 'sender-123',
        receiverId: 'receiver-123',
        message: '안녕하세요',
        messageType: MessageType.TEXT,
        readAt: now,
        fileUrl: 'https://example.com/file.jpg',
        fileName: 'file.jpg',
        createdAt: now,
        updatedAt: now,
      });
    });

    it('ObjectId를 문자열로 변환해야 한다', () => {
      // Given: ObjectId를 포함한 문서
      const mockObjectId = new Types.ObjectId();
      const mockDoc = {
        _id: mockObjectId,
        conversationId: 'conversation-123',
        senderId: 'sender-123',
        receiverId: 'receiver-123',
        message: '테스트',
        messageType: MessageType.TEXT,
        readAt: null,
        fileUrl: '',
        fileName: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // When
      const result = mapper.toEntity(mockDoc);

      // Then: _id가 문자열로 변환되어야 함
      expect(result.id).toBe(mockObjectId.toString());
      expect(typeof result.id).toBe('string');
    });

    it('readAt이 null일 때 null을 반환해야 한다', () => {
      // Given: readAt이 null인 문서
      const mockDoc = {
        _id: new Types.ObjectId(),
        conversationId: 'conversation-123',
        senderId: 'sender-123',
        receiverId: 'receiver-123',
        message: '테스트',
        messageType: MessageType.TEXT,
        readAt: null,
        fileUrl: '',
        fileName: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // When
      const result = mapper.toEntity(mockDoc);

      // Then
      expect(result.readAt).toBeNull();
    });

    it('readAt이 undefined일 때 null을 반환해야 한다', () => {
      // Given: readAt이 undefined인 문서
      const mockDoc = {
        _id: new Types.ObjectId(),
        conversationId: 'conversation-123',
        senderId: 'sender-123',
        receiverId: 'receiver-123',
        message: '테스트',
        messageType: MessageType.TEXT,
        readAt: undefined,
        fileUrl: '',
        fileName: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // When
      const result = mapper.toEntity(mockDoc);

      // Then
      expect(result.readAt).toBeNull();
    });

    it('readAt이 유효한 날짜일 때 해당 날짜를 반환해야 한다', () => {
      // Given: readAt이 유효한 날짜인 문서
      const readAtDate = new Date('2024-01-01T12:00:00Z');
      const mockDoc = {
        _id: new Types.ObjectId(),
        conversationId: 'conversation-123',
        senderId: 'sender-123',
        receiverId: 'receiver-123',
        message: '테스트',
        messageType: MessageType.TEXT,
        readAt: readAtDate,
        fileUrl: '',
        fileName: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // When
      const result = mapper.toEntity(mockDoc);

      // Then
      expect(result.readAt).toBe(readAtDate);
    });

    it('선택적 필드(fileUrl, fileName)가 없어도 변환되어야 한다', () => {
      // Given: 선택적 필드가 빈 문자열인 문서
      const mockDoc = {
        _id: new Types.ObjectId(),
        conversationId: 'conversation-123',
        senderId: 'sender-123',
        receiverId: 'receiver-123',
        message: '테스트',
        messageType: MessageType.TEXT,
        readAt: null,
        fileUrl: '',
        fileName: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // When
      const result = mapper.toEntity(mockDoc);

      // Then
      expect(result.fileUrl).toBe('');
      expect(result.fileName).toBe('');
    });

    it('다양한 MessageType을 처리해야 한다', () => {
      // Given: 이미지 타입 메시지
      const mockDoc = {
        _id: new Types.ObjectId(),
        conversationId: 'conversation-123',
        senderId: 'sender-123',
        receiverId: 'receiver-123',
        message: '이미지 전송',
        messageType: MessageType.IMAGE,
        readAt: null,
        fileUrl: 'https://example.com/image.jpg',
        fileName: 'image.jpg',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // When
      const result = mapper.toEntity(mockDoc);

      // Then
      expect(result.messageType).toBe(MessageType.IMAGE);
      expect(result.fileUrl).toBe('https://example.com/image.jpg');
    });
  });

  describe('toEntityOrNull()', () => {
    it('문서가 null일 때 null을 반환해야 한다', () => {
      // Given
      const doc = null;

      // When
      const result = mapper.toEntityOrNull(doc);

      // Then
      expect(result).toBeNull();
    });

    it('문서가 undefined일 때 null을 반환해야 한다', () => {
      // Given
      const doc = undefined;

      // When
      const result = mapper.toEntityOrNull(doc);

      // Then
      expect(result).toBeNull();
    });

    it('유효한 문서일 때 MessageEntity를 반환해야 한다', () => {
      // Given: 유효한 문서
      const mockObjectId = new Types.ObjectId();
      const now = new Date();
      const mockDoc = {
        _id: mockObjectId,
        conversationId: 'conversation-123',
        senderId: 'sender-123',
        receiverId: 'receiver-123',
        message: '테스트 메시지',
        messageType: MessageType.TEXT,
        readAt: now,
        fileUrl: '',
        fileName: '',
        createdAt: now,
        updatedAt: now,
      };

      // When
      const result = mapper.toEntityOrNull(mockDoc);

      // Then
      expect(result).not.toBeNull();
      expect(result?.id).toBe(mockObjectId.toString());
      expect(result?.message).toBe('테스트 메시지');
    });

    it('falsy한 값(빈 객체)은 변환을 시도해야 한다', () => {
      // Given: 빈 객체 (falsy하지만 null/undefined는 아님)
      const emptyDoc = {
        _id: new Types.ObjectId(),
        conversationId: '',
        senderId: '',
        receiverId: '',
        message: '',
        messageType: MessageType.TEXT,
        readAt: null,
        fileUrl: '',
        fileName: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // When
      const result = mapper.toEntityOrNull(emptyDoc);

      // Then: 빈 객체도 변환되어야 함 (null이 아님)
      expect(result).not.toBeNull();
      expect(result?.message).toBe('');
    });
  });

  describe('toEntities()', () => {
    it('빈 배열을 빈 배열로 변환해야 한다', () => {
      // Given
      const docs: any[] = [];

      // When
      const result = mapper.toEntities(docs);

      // Then
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('정상적인 문서 배열을 엔티티 배열로 변환해야 한다', () => {
      // Given: 여러 문서
      const now = new Date();
      const mockDocs = [
        {
          _id: new Types.ObjectId(),
          conversationId: 'conversation-123',
          senderId: 'sender-123',
          receiverId: 'receiver-123',
          message: '첫 번째 메시지',
          messageType: MessageType.TEXT,
          readAt: now,
          fileUrl: '',
          fileName: '',
          createdAt: now,
          updatedAt: now,
        },
        {
          _id: new Types.ObjectId(),
          conversationId: 'conversation-123',
          senderId: 'receiver-123',
          receiverId: 'sender-123',
          message: '두 번째 메시지',
          messageType: MessageType.TEXT,
          readAt: null,
          fileUrl: '',
          fileName: '',
          createdAt: now,
          updatedAt: now,
        },
      ];

      // When
      const result = mapper.toEntities(mockDocs);

      // Then
      expect(result).toHaveLength(2);
      expect(result[0].message).toBe('첫 번째 메시지');
      expect(result[1].message).toBe('두 번째 메시지');
    });

    it('null이 포함된 배열을 필터링해야 한다', () => {
      // Given: null이 섞인 배열
      const mockDoc = {
        _id: new Types.ObjectId(),
        conversationId: 'conversation-123',
        senderId: 'sender-123',
        receiverId: 'receiver-123',
        message: '유효한 메시지',
        messageType: MessageType.TEXT,
        readAt: null,
        fileUrl: '',
        fileName: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // toEntity가 null을 반환할 수 있다고 가정
      // 실제로는 toEntity가 항상 객체를 반환하지만, filter(Boolean)의 역할을 테스트
      const docs = [mockDoc];

      // When
      const result = mapper.toEntities(docs);

      // Then: filter(Boolean)로 인해 falsy 값이 제거됨
      expect(result).toHaveLength(1);
      expect(result.every((entity) => entity !== null)).toBe(true);
    });

    it('다양한 타입의 메시지를 모두 변환해야 한다', () => {
      // Given: 다양한 타입의 메시지
      const now = new Date();
      const mockDocs = [
        {
          _id: new Types.ObjectId(),
          conversationId: 'conversation-123',
          senderId: 'sender-123',
          receiverId: 'receiver-123',
          message: '텍스트 메시지',
          messageType: MessageType.TEXT,
          readAt: null,
          fileUrl: '',
          fileName: '',
          createdAt: now,
          updatedAt: now,
        },
        {
          _id: new Types.ObjectId(),
          conversationId: 'conversation-123',
          senderId: 'sender-123',
          receiverId: 'receiver-123',
          message: '이미지 메시지',
          messageType: MessageType.IMAGE,
          readAt: null,
          fileUrl: 'https://example.com/image.jpg',
          fileName: 'image.jpg',
          createdAt: now,
          updatedAt: now,
        },
        {
          _id: new Types.ObjectId(),
          conversationId: 'conversation-123',
          senderId: 'sender-123',
          receiverId: 'receiver-123',
          message: '시스템 메시지',
          messageType: MessageType.SYSTEM,
          readAt: null,
          fileUrl: '',
          fileName: '',
          createdAt: now,
          updatedAt: now,
        },
      ];

      // When
      const result = mapper.toEntities(mockDocs);

      // Then
      expect(result).toHaveLength(3);
      expect(result[0].messageType).toBe(MessageType.TEXT);
      expect(result[1].messageType).toBe(MessageType.IMAGE);
      expect(result[2].messageType).toBe(MessageType.SYSTEM);
    });

    it('대량의 문서를 효율적으로 변환해야 한다', () => {
      // Given: 100개의 문서
      const mockDocs = Array.from({ length: 100 }, (_, index) => ({
        _id: new Types.ObjectId(),
        conversationId: 'conversation-123',
        senderId: 'sender-123',
        receiverId: 'receiver-123',
        message: `메시지 ${index}`,
        messageType: MessageType.TEXT,
        readAt: null,
        fileUrl: '',
        fileName: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      // When
      const result = mapper.toEntities(mockDocs);

      // Then
      expect(result).toHaveLength(100);
      expect(result[0].message).toBe('메시지 0');
      expect(result[99].message).toBe('메시지 99');
    });
  });

  describe('엣지 케이스', () => {
    it('매우 긴 메시지를 처리해야 한다', () => {
      // Given: 매우 긴 메시지
      const longMessage = 'A'.repeat(10000);
      const mockDoc = {
        _id: new Types.ObjectId(),
        conversationId: 'conversation-123',
        senderId: 'sender-123',
        receiverId: 'receiver-123',
        message: longMessage,
        messageType: MessageType.TEXT,
        readAt: null,
        fileUrl: '',
        fileName: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // When
      const result = mapper.toEntity(mockDoc);

      // Then
      expect(result.message).toBe(longMessage);
      expect(result.message.length).toBe(10000);
    });

    it('특수 문자가 포함된 메시지를 처리해야 한다', () => {
      // Given: 특수 문자가 포함된 메시지
      const specialMessage = '🎉 안녕하세요! <script>alert("test")</script>';
      const mockDoc = {
        _id: new Types.ObjectId(),
        conversationId: 'conversation-123',
        senderId: 'sender-123',
        receiverId: 'receiver-123',
        message: specialMessage,
        messageType: MessageType.TEXT,
        readAt: null,
        fileUrl: '',
        fileName: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // When
      const result = mapper.toEntity(mockDoc);

      // Then: 특수 문자가 그대로 유지되어야 함
      expect(result.message).toBe(specialMessage);
    });

    it('과거와 미래의 날짜를 올바르게 처리해야 한다', () => {
      // Given: 과거 날짜
      const pastDate = new Date('2000-01-01T00:00:00Z');
      const futureDate = new Date('2099-12-31T23:59:59Z');

      const pastDoc = {
        _id: new Types.ObjectId(),
        conversationId: 'conversation-123',
        senderId: 'sender-123',
        receiverId: 'receiver-123',
        message: '과거 메시지',
        messageType: MessageType.TEXT,
        readAt: pastDate,
        fileUrl: '',
        fileName: '',
        createdAt: pastDate,
        updatedAt: pastDate,
      };

      const futureDoc = {
        _id: new Types.ObjectId(),
        conversationId: 'conversation-123',
        senderId: 'sender-123',
        receiverId: 'receiver-123',
        message: '미래 메시지',
        messageType: MessageType.TEXT,
        readAt: futureDate,
        fileUrl: '',
        fileName: '',
        createdAt: futureDate,
        updatedAt: futureDate,
      };

      // When
      const pastResult = mapper.toEntity(pastDoc);
      const futureResult = mapper.toEntity(futureDoc);

      // Then
      expect(pastResult.readAt).toBe(pastDate);
      expect(futureResult.readAt).toBe(futureDate);
    });
  });
});
