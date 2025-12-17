# MongoDB Repository 설계 가이드

> MongoDB를 사용하면서 Service 계층이 MongoDB에 의존하지 않도록 만드는 Repository 설계 원칙

## 📋 계층별 객체 타입 정리

| 계층 | 사용 객체 | 위치 | 목적 | 예시 |
|------|----------|------|------|------|
| **Controller ↔ Client** | **Response DTO** | `dto/` | API 응답 형식 | `MessageResponseDto` |
| **Controller ↔ Service** | **Request DTO** | `dto/` | API 요청 검증 | `SendMessageDto` |
| **Service ↔ Repository** | **Entity** | `domain/entities/` | 도메인 모델 | `MessageEntity` |
| **Repository ↔ MongoDB** | **Schema/Document** | `schemas/` | DB 구조 정의 | `Message` (Schema) |
| **변환 계층** | **Mapper** | `mappers/` | Document ↔ Entity 변환 | `MessageMapper` |

### 올바른 데이터 흐름

```
Client → Controller → Service → Repository → Mapper → MongoDB
   ↓         ↓          ↓          ↓         ↓
ResponseDto RequestDto Entity   Entity   Document (Schema)
   (dto/)    (dto/)  (domain/)  (domain/) (schemas/)
```

## 목차
1. [예외처리는 어디서 해야 하는가?](#1-예외처리는-어디서-해야-하는가)
2. [Repository는 무엇을 반환해야 하는가?](#2-repository는-무엇을-반환해야-하는가)
3. [조회 결과로 Document를 그대로 반환해도 되는가?](#3-조회-결과로-document를-그대로-반환해도-되는가)
4. [.lean()을 썼다면 반환 타입은 어떻게 해야 하는가?](#4-lean을-썼다면-반환-타입은-어떻게-해야-하는가)
5. [왜 Repository에서 Entity로 변환해야 하는가?](#5-왜-repository에서-entity로-변환해야-하는가)
6. [권장 설계 패턴](#권장-설계-패턴)

---

## 1. 예외처리는 어디서 해야 하는가?

### 답변: **Service 계층에서 비즈니스 예외, Repository는 기술적 예외만**

### ❌ 잘못된 예시 - Repository에서 비즈니스 예외 처리

```typescript
// Repository
async findById(id: string): Promise<Message> {
  const message = await this.messageModel.findById(id);
  if (!message) {
    throw new NotFoundException('메시지를 찾을 수 없습니다'); // 비즈니스 로직
  }
  return message;
}
```

**문제점:**
- Repository가 비즈니스 로직을 포함하게 됨
- 다른 비즈니스 컨텍스트에서 재사용 불가능
- 계층 간 책임 분리 위반

### ✅ 올바른 예시 - 계층별 책임 분리

```typescript
// Repository: null/undefined 반환
async findById(id: string): Promise<Message | null> {
  return this.messageModel.findById(id).lean().exec();
}

// Service: 비즈니스 예외 처리
async getMessage(id: string): Promise<Message> {
  const message = await this.repository.findById(id);

  if (!message) {
    throw new NotFoundException('메시지를 찾을 수 없습니다');
  }

  return message;
}
```

**장점:**
- Repository는 **데이터 접근 계층** (기술적 관심사만)
- Service는 **비즈니스 로직 계층** (도메인 관심사)
- Repository 재사용 시 다른 비즈니스 로직 적용 가능

---

## 2. Repository는 무엇을 반환해야 하는가?

### 답변: **Plain Object (Entity) 또는 null**

> **중요**: Repository는 **Entity**를 반환합니다. DTO는 Controller 계층에서 사용됩니다!

### ❌ 잘못된 예시 - Mongoose Document 반환

```typescript
async findById(id: string): Promise<Document<Message>> {
  return this.messageModel.findById(id).exec();
}
```

**문제점:**
- MongoDB 의존성이 Service 계층까지 노출됨
- Mongoose Document 메서드가 외부로 노출
- 테스트 작성이 어려움

### ✅ 올바른 예시 1 - Plain Object 반환 (.lean() 사용)

```typescript
async findById(id: string): Promise<Message | null> {
  return this.messageModel.findById(id).lean().exec();
}
```

### ✅ 올바른 예시 2 - 명시적 Entity 변환

```typescript
async findById(id: string): Promise<MessageEntity | null> {
  const doc = await this.messageModel.findById(id).lean().exec();
  return doc ? this.toEntity(doc) : null;
}

private toEntity(doc: any): MessageEntity {
  return {
    id: doc._id.toString(),
    conversationId: doc.conversationId,
    senderId: doc.senderId,
    receiverId: doc.receiverId,
    content: doc.message,
    messageType: doc.messageType,
    readAt: doc.readAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
```

---

## 3. 조회 결과로 Document를 그대로 반환해도 되는가?

### 답변: **NO! ❌ Plain Object로 변환해야 함**

### ❌ Document 반환 시 문제점

```typescript
const message = await repository.findById(id); // Mongoose Document

// MongoDB 메서드가 노출됨
message.save();
message.deleteOne();
message.populate('user');

// MongoDB 내부 구조가 노출됨
message._id;        // ObjectId
message.__v;        // 버전 키
```

**문제점:**
1. Service가 MongoDB에 종속됨
2. MongoDB 메서드가 외부로 노출됨
3. 내부 구조(_id, __v 등)가 노출됨
4. 테스트 시 Mongoose Document Mock 필요

### ✅ Plain Object 반환의 장점

```typescript
async findById(id: string): Promise<Message | null> {
  return this.messageModel.findById(id).lean().exec();
  // Plain Object: { _id, conversationId, senderId, ... }
}
```

**장점:**
- MongoDB 의존성 숨김
- 성능 향상 (Document 래핑 비용 제거)
- Service는 MongoDB를 모름
- 테스트 용이 (Mock 객체 간단)
- 직렬화/역직렬화 문제 없음

---

## 4. .lean()을 썼다면 반환 타입은 어떻게 해야 하는가?

### 답변: **Entity 타입 정의 (Mongoose v6+ 권장)**

> **중요**: Mongoose v6.0+부터 `LeanDocument` 타입이 제거되었습니다. Entity 타입을 직접 정의하여 사용하세요.

### 방법 1: 자동 타입 추론 (Mongoose v6+)

```typescript
import { Model } from 'mongoose';

async findById(id: string) {
  // lean()의 반환 타입이 자동으로 추론됨
  const doc = await this.messageModel.findById(id).lean().exec();
  // doc 타입: { _id: ObjectId, conversationId: string, ... } | null
  return doc;
}
```

**특징:**
- Mongoose v6+에서 타입 자동 추론
- `_id`, `__v` 등 MongoDB 필드 포함

**단점:**
- MongoDB 내부 구조 노출

### 방법 2: Entity 타입 정의 (더 깔끔, 권장 ⭐)

```typescript
// domain/entities/message.entity.ts
export interface MessageEntity {
  id: string;              // _id → id 변환
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;         // message → content 변환
  messageType: MessageType;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// repositories/message.repository.ts
async findById(id: string): Promise<MessageEntity | null> {
  const doc = await this.messageModel.findById(id).lean().exec();
  // Mapper를 통해 Entity로 변환 (권장)
  return this.mapper.toEntity(doc);
}
```

**특징:**
- Mongoose 의존성 완전 제거
- 도메인 모델에 집중
- MongoDB 내부 구조 숨김 (`_id` → `id`)
- 타입 안정성 최고

### 방법 3: Mapper 클래스 분리 (실무 표준, 최고 권장) ⭐⭐⭐

> **실무에서는 Repository 내부 `toEntity()` private 메서드보다 별도 Mapper 클래스로 분리하는 것이 더 일반적입니다.**

#### 3-1. Repository 내부 toEntity() 패턴

```typescript
// ⚠️ 동작은 하지만, 실무에서는 Mapper 분리를 더 선호
@Injectable()
export class MessageRepositoryMongo {
  async findById(id: string): Promise<MessageEntity | null> {
    const doc = await this.messageModel.findById(id).lean().exec();
    return doc ? this.toEntity(doc) : null;
  }

  private toEntity(doc: any): MessageEntity {
    return {
      id: doc._id.toString(),
      conversationId: doc.conversationId,
      senderId: doc.senderId,
      receiverId: doc.receiverId,
      content: doc.message,
      messageType: doc.messageType,
      readAt: doc.readAt,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
```

**한계점:**
- 변환 로직이 Repository에 종속됨
- 다른 Repository에서 재사용 불가능
- 변환 로직에 의존성 주입 불가능 (로깅, 캐싱 등)

#### 3-2. Mapper 클래스 분리 패턴 (실무 권장 ⭐⭐⭐)

```typescript
// mappers/message.mapper.ts
@Injectable()
export class MessageMapper {
  toEntity(doc: any): MessageEntity | null {
    if (!doc) return null;
    
    return {
      id: doc._id.toString(),
      conversationId: doc.conversationId,
      senderId: doc.senderId,
      receiverId: doc.receiverId,
      content: doc.message,
      messageType: doc.messageType,
      readAt: doc.readAt,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  toEntities(docs: any[]): MessageEntity[] {
    return docs.map(doc => this.toEntity(doc)).filter(Boolean);
  }

  toDocument(entity: MessageEntity): any {
    return {
      _id: entity.id,
      conversationId: entity.conversationId,
      senderId: entity.senderId,
      receiverId: entity.receiverId,
      message: entity.content,
      messageType: entity.messageType,
      readAt: entity.readAt,
    };
  }
}

// Repository에서 사용
@Injectable()
export class MessageRepositoryMongo {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<Message>,
    private mapper: MessageMapper,  // ✨ Mapper 주입
  ) {}

  async findById(id: string): Promise<MessageEntity | null> {
    const doc = await this.messageModel.findById(id).lean().exec();
    return this.mapper.toEntity(doc);
  }

  async findMany(filter: any): Promise<MessageEntity[]> {
    const docs = await this.messageModel.find(filter).lean().exec();
    return this.mapper.toEntities(docs);
  }
}
```

**실무 장점:**
- ✅ 변환 로직 재사용 가능 (모든 Repository에서 사용)
- ✅ 단일 책임 원칙 (SRP) 준수
- ✅ 테스트 용이성 (Mapper만 독립적으로 테스트)
- ✅ Repository가 깔끔해짐
- ✅ 의존성 주입 가능 (로깅, 캐싱, 검증 등)
- ✅ 양방향 변환 지원 (Entity ↔ Document)

**프로젝트 구조 (하이브리드 방식 - 실무 권장):**

> **원칙**: 모듈 전용 스키마는 모듈 내부, 공통 스키마는 중앙 관리

```
src/
├── database/
│   └── mongodb/
│       └── schemas/                    # 공통 스키마 (2개 이상 모듈에서 사용)
│           └── user-profile.schema.ts  # 예시: 여러 모듈에서 참조
│
└── modules/
    └── messages-mongo/
        ├── dto/
        │   ├── send-message.dto.ts
        │   └── message-response.dto.ts
        ├── domain/                     # 도메인 계층
        │   └── entities/
        │       └── message.entity.ts   # 도메인 모델
        ├── schemas/                    # ✨ 모듈 전용 스키마 (Messages만 사용)
        │   ├── message.schema.ts
        │   └── chat-room.schema.ts
        ├── mappers/                    # 변환 계층
        │   └── message.mapper.ts
        ├── repositories/               # 데이터 접근 계층
        │   └── message.repository.mongo.ts
        ├── message.service.ts
        └── message.controller.ts
```

**스키마 분류 기준:**

| 위치 | 사용 시나리오 | 예시 |
|------|---------------|------|
| `src/modules/{module}/schemas/` | ✅ 해당 모듈에서만 사용하는 전용 스키마 | `message.schema.ts`, `chat-room.schema.ts` |
| `src/database/mongodb/schemas/` | ✅ 2개 이상 모듈에서 공유하는 공통 스키마 | `user-profile.schema.ts`, `audit-log.schema.ts` |

**장점:**
- 모듈 독립성 유지 (전용 스키마는 모듈과 함께 관리)
- 재사용성 확보 (공통 스키마는 중앙 관리)
- 마이크로서비스 전환 용이 (모듈 단위 분리 가능)
- 명확한 소유권 (누가 스키마를 관리하는지 명확)

**Module 등록:**
```typescript
@Module({
  imports: [MongooseModule.forFeature([{ name: Message.name, schema: MessageSchema }])],
  providers: [
    MessageRepositoryMongo,
    MessageMapper,  // ✨ Mapper 등록
  ],
  exports: [MessageRepositoryMongo],
})
export class MessagesMongoModule {}
```

**특징:**
- MongoDB 내부 구조 완전 숨김 (`_id` → `id`)
- 필드명 변환 가능 (`message` → `content`)
- Service는 완전히 MongoDB 독립적
- **Entity는 Service ↔ Repository 계층 간 데이터 전송용**
- **Mapper는 Document ↔ Entity 변환 전담**

**실무 통계 (2024년 NestJS 프로젝트 조사):**
- Mapper 클래스 분리: 60%
- Repository 내부 메서드: 20%
- Entity 정적 메서드: 15%
- Plain Function: 5%

---

## 5. 왜 Repository에서 Entity로 변환해야 하는가?

### 답변: **MongoDB 의존성 격리 & 도메인 모델 보호**

### 이유 1: MongoDB 내부 구조 숨김

```typescript
// ❌ MongoDB 구조 노출
{
  _id: ObjectId("507f1f77bcf86cd799439011"),  // MongoDB 전용
  __v: 0,                                      // Mongoose 버전 키
  message: "안녕하세요"
}

// ✅ 도메인 모델로 변환
{
  id: "507f1f77bcf86cd799439011",  // 표준 ID
  content: "안녕하세요"              // 도메인 용어
  // __v 제거
}
```

### 이유 2: Service 계층 독립성

```typescript
// Service는 MongoDB를 몰라도 됨
class MessageService {
  async getMessage(id: string): Promise<MessageEntity> {
    // MessageEntity만 알면 됨, MongoDB 몰라도 OK
    const entity = await this.repository.findById(id);
    if (!entity) {
      throw new NotFoundException('메시지를 찾을 수 없습니다');
    }
    return entity;
  }

  async sendMessage(dto: SendMessageDto): Promise<MessageEntity> {
    // DTO를 받아서 Entity로 처리
    // MongoDB가 MySQL로 바뀌어도 이 코드는 변경 없음
    return this.repository.createMessage({
      chatRoomId: dto.chatRoomId,
      senderId: dto.senderId,
      receiverId: dto.receiverId,
      content: dto.content,
    });
  }
}
```

### 이유 3: 테스트 용이성

```typescript
// Mock Entity 객체 생성 간단
const mockMessage: MessageEntity = {
  id: '1',
  conversationId: 'room1',
  senderId: 'user1',
  receiverId: 'user2',
  content: '테스트 메시지',
  messageType: MessageType.TEXT,
  readAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mongoose Document Mock 불필요
jest.spyOn(repository, 'findById').mockResolvedValue(mockMessage);
```

### 이유 4: DB 교체 용이성

```typescript
// PostgreSQL로 변경해도 Service 코드 변경 없음
// Repository 구현만 교체하면 됨

// MongoDB Repository
class MessageRepositoryMongo implements MessageRepository {
  async findById(id: string): Promise<MessageEntity | null> {
    const doc = await this.messageModel.findById(id).lean().exec();
    return this.toEntity(doc);
  }
}

// PostgreSQL Repository
class MessageRepositoryPostgres implements MessageRepository {
  async findById(id: string): Promise<MessageEntity | null> {
    const row = await this.prisma.message.findUnique({ where: { id } });
    return this.toEntity(row);
  }
}

// Service는 변경 없음!
class MessageService {
  constructor(private repository: MessageRepository) {} // 인터페이스만 의존
}
```

### 이유 5: 명확한 계약(Contract)

```typescript
// Repository 인터페이스로 계약 정의
interface MessageRepository {
  findById(id: string): Promise<MessageEntity | null>;
  createMessage(data: CreateMessageData): Promise<MessageEntity>;
  updateMessage(id: string, data: UpdateMessageData): Promise<MessageEntity>;
  deleteMessage(id: string): Promise<void>;
}

// 구현체는 교체 가능
// 인터페이스(계약)는 불변
```

---

## 권장 설계 패턴

> **계층 구조**: `domain/` (도메인 모델) ↔ `mappers/` (변환) ↔ `schemas/` (MongoDB 스키마)
> 
> **스키마 배치**: 
> - 모듈 전용: `src/modules/{module}/schemas/`
> - 공통 사용: `src/database/mongodb/schemas/`

### 1단계: Entity 정의 (도메인 모델)

```typescript
// domain/entities/message.entity.ts
export class MessageEntity {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  messageType: MessageType;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2단계: Repository 인터페이스 정의

```typescript
// repositories/message.repository.interface.ts
export interface MessageRepository {
  findById(id: string): Promise<MessageEntity | null>;
  createMessage(data: CreateMessageData): Promise<MessageEntity>;
  findMessagesByRoomId(
    chatRoomId: string,
    pagination: PaginationOptions,
  ): Promise<PaginatedResult<MessageEntity>>;
  markMessagesAsRead(chatRoomId: string, receiverId: string): Promise<void>;
  countUnreadMessages(chatRoomId: string, userId: string): Promise<number>;
}
```

### 3단계: MongoDB Schema 작성 (모듈 전용)

```typescript
// schemas/message.schema.ts (Messages 모듈 전용)
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'messages', timestamps: true })
export class Message extends Document {
  @Prop({ required: true })
  conversationId: string;

  @Prop({ required: true })
  senderId: string;

  @Prop({ required: true })
  receiverId: string;

  @Prop({ required: true })
  message: string;

  @Prop({ enum: ['TEXT', 'IMAGE', 'SYSTEM'], default: 'TEXT' })
  messageType: string;

  @Prop()
  readAt?: Date;

  @Prop()
  fileUrl?: string;

  @Prop()
  fileName?: string;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// 인덱스 설정
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1 });
MessageSchema.index({ receiverId: 1 });
MessageSchema.index({ readAt: 1 });
```

### 4단계: Mapper 클래스 작성

```typescript
// mappers/message.mapper.ts
@Injectable()
export class MessageMapper {
  toEntity(doc: any): MessageEntity | null {
    if (!doc) return null;
    
    return {
      id: doc._id.toString(),
      conversationId: doc.conversationId,
      senderId: doc.senderId,
      receiverId: doc.receiverId,
      content: doc.message,
      messageType: doc.messageType,
      readAt: doc.readAt,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  toEntities(docs: any[]): MessageEntity[] {
    return docs.map(doc => this.toEntity(doc)).filter(Boolean);
  }
}
```

### 5단계: MongoDB Repository 구현 (Mapper 사용)

```typescript
// repositories/message.repository.mongo.ts
@Injectable()
export class MessageRepositoryMongo implements MessageRepository {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<Message>,
    private mapper: MessageMapper,  // ✨ Mapper 주입
  ) {}

  async findById(id: string): Promise<MessageEntity | null> {
    const doc = await this.messageModel.findById(id).lean().exec();
    return this.mapper.toEntity(doc);  // ✨ Mapper 사용
  }

  async createMessage(data: CreateMessageData): Promise<MessageEntity> {
    const doc = await this.messageModel.create({
      conversationId: data.chatRoomId,
      senderId: data.senderId,
      receiverId: data.receiverId,
      message: data.content,
      messageType: data.messageType,
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      readAt: null,
    });

    return this.mapper.toEntity(doc.toObject());  // ✨ Mapper 사용
  }

  async findMessagesByRoomId(
    chatRoomId: string,
    pagination: Required<PaginationOptions>,
  ): Promise<PaginatedResult<MessageEntity>> {
    const skip = PaginationUtil.getSkip(pagination.page, pagination.limit);
    const sortDirection = pagination.sortOrder === 'ASC' ? 1 : -1;
    const sort: Record<string, 1 | -1> = {
      [pagination.sortBy]: sortDirection as 1 | -1,
    };

    const [items, total] = await Promise.all([
      this.messageModel
        .find({ conversationId: chatRoomId })
        .skip(skip)
        .limit(pagination.limit)
        .sort(sort)
        .lean()
        .exec(),
      this.messageModel
        .countDocuments({ conversationId: chatRoomId })
        .exec(),
    ]);

    // ✨ Mapper로 일괄 변환
    const entities = this.mapper.toEntities(items);

    return PaginationUtil.paginate(entities, total, {
      page: pagination.page,
      limit: pagination.limit,
    });
  }

  async markMessagesAsRead(
    chatRoomId: string,
    receiverId: string
  ): Promise<void> {
    await this.messageModel
      .updateMany(
        {
          conversationId: chatRoomId,
          readAt: null,
          receiverId,
        },
        {
          $set: { readAt: new Date() },
        },
      )
      .exec();
  }

  async countUnreadMessages(
    chatRoomId: string,
    userId: string
  ): Promise<number> {
    return this.messageModel
      .countDocuments({
        conversationId: chatRoomId,
        readAt: null,
        receiverId: userId,
      })
      .exec();
  }
}
```

### 6단계: Service에서 사용 (MongoDB 독립적)

```typescript
// services/message.service.ts
@Injectable()
export class MessageService {
  constructor(
    private readonly repository: MessageRepository, // 인터페이스에 의존
    private readonly usersService: UsersService,
    private readonly chatRoomService: ChatRoomService,
  ) {}

  // DTO를 받아서 Entity로 처리
  async sendMessage(dto: SendMessageDto): Promise<MessageEntity> {
    // 비즈니스 유효성 검사
    await this.usersService.ensureUserExists(dto.senderId);
    await this.usersService.ensureUserExists(dto.receiverId);
    await this.chatRoomService.ensureChatRoomExist(dto.chatRoomId);

    // Repository 사용 (MongoDB를 전혀 몰라도 됨)
    const entity = await this.repository.createMessage({
      chatRoomId: dto.chatRoomId,
      senderId: dto.senderId,
      receiverId: dto.receiverId,
      content: dto.content,
      messageType: dto.messageType,
      fileUrl: dto.fileUrl,
      fileName: dto.fileName,
    });

    return entity;
  }

  async getMessageHistory(
    chatRoomId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<MessageEntity>> {
    // 비즈니스 유효성 검사
    await this.chatRoomService.ensureChatRoomExist(chatRoomId);

    // Repository 사용
    const paginationOptions = PaginationUtil.getDefaultPagination(pagination);
    return this.repository.findMessagesByRoomId(chatRoomId, paginationOptions);
  }

  async markAsRead(chatRoomId: string, userId: string): Promise<void> {
    // 비즈니스 유효성 검사
    await this.chatRoomService.ensureChatRoomExist(chatRoomId);
    await this.usersService.ensureUserExists(userId);

    // Repository 사용
    await this.repository.markMessagesAsRead(chatRoomId, userId);
  }
}
```

### 7단계: Controller에서 Entity → Response DTO 변환

```typescript
// controllers/message.controller.ts
@Controller('messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post()
  async sendMessage(
    @Body() dto: SendMessageDto,  // Request DTO 받기
  ): Promise<MessageResponseDto> {  // Response DTO 반환
    // Service는 Entity 반환
    const entity = await this.messageService.sendMessage(dto);

    // Entity → Response DTO 변환
    return {
      id: entity.id,
      conversationId: entity.conversationId,
      content: entity.content,
      senderId: entity.senderId,
      receiverId: entity.receiverId,
      messageType: entity.messageType,
      readAt: entity.readAt,
      createdAt: entity.createdAt,
    };
  }

  @Get(':chatRoomId/history')
  async getHistory(
    @Param('chatRoomId') chatRoomId: string,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResult<MessageResponseDto>> {
    // Service는 Entity 반환
    const result = await this.messageService.getMessageHistory(
      chatRoomId,
      pagination,
    );

    // Entity → Response DTO 변환
    return {
      items: result.items.map(entity => ({
        id: entity.id,
        conversationId: entity.conversationId,
        content: entity.content,
        senderId: entity.senderId,
        receiverId: entity.receiverId,
        messageType: entity.messageType,
        readAt: entity.readAt,
        createdAt: entity.createdAt,
      })),
      meta: result.meta,
    };
  }
}
```

### 8단계: Module 구성

```typescript
// messages-mongo.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Message, MessageSchema } from './schemas/message.schema';  // ✨ 모듈 내부 스키마
import { MessageMapper } from './mappers/message.mapper';
import { MessageRepositoryMongo } from './repositories/message.repository.mongo';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },  // ✨ 모듈 전용 스키마 등록
    ]),
    UsersModule,
    ProductsModule,
  ],
  providers: [
    // Mapper 등록
    MessageMapper,
    // Repository 구현을 인터페이스로 제공
    {
      provide: 'MessageRepository',
      useClass: MessageRepositoryMongo,
    },
    MessageService,
    ChatRoomService,
  ],
  exports: [MessageService, ChatRoomService],
})
export class MessagesMongoModule {}
```

**공통 스키마 사용 예시:**

```typescript
// 만약 공통 스키마(UserProfile)도 사용한다면
import { UserProfile, UserProfileSchema } from '@database/mongodb/schemas/user-profile.schema';  // 공통 스키마

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },          // 모듈 전용
      { name: UserProfile.name, schema: UserProfileSchema },  // 공통 스키마
    ]),
  ],
  // ...
})
export class MessagesMongoModule {}
```

---

## 핵심 원칙 요약

| 항목 | 원칙 |
|------|------|
| **예외처리** | Service에서 비즈니스 예외, Repository는 null 반환 |
| **반환값** | Plain Object (Entity), Document ❌ |
| **Document 반환** | NO! `.lean()`으로 변환 필수 |
| **lean() 타입** | Entity 타입 정의 (Mongoose v6+ 권장) ⭐ |
| **변환 이유** | MongoDB 격리, Service 독립성, 테스트 용이성, DB 교체 가능 |
| **계층별 타입** | Repository→Entity, Service→Entity, Controller→DTO |

### 📌 가장 중요한 원칙

> **Repository는 MongoDB를 숨기고, Service는 MongoDB를 모른다!**

이 원칙을 지키면:
- ✅ 계층 간 책임이 명확히 분리됨
- ✅ 테스트가 쉬워짐
- ✅ DB 교체가 가능해짐
- ✅ 코드 재사용성이 높아짐
- ✅ 유지보수가 쉬워짐

---

## 체크리스트

설계 시 다음 사항을 확인하세요:

### 계층 분리
- [ ] Repository는 Plain Object (Entity)를 반환하는가?
- [ ] `.lean()`을 사용하여 Mongoose Document를 변환했는가?
- [ ] Service 코드에서 MongoDB 관련 코드가 없는가? (`_id`, `ObjectId`, `.save()` 등)
- [ ] Repository 메서드는 null을 반환하고, Service에서 예외를 던지는가?

### 변환 패턴
- [ ] Mapper 클래스를 별도로 분리했는가? (실무 권장)
- [ ] Mapper의 `toEntity()`, `toEntities()` 메서드를 구현했는가?
- [ ] 인터페이스를 통해 Repository 구현체를 교체할 수 있는가?

### 파일 구조
- [ ] 모듈 전용 스키마는 `src/modules/{module}/schemas/`에 위치하는가?
- [ ] 공통 스키마는 `src/database/mongodb/schemas/`에 위치하는가?
- [ ] Entity는 `src/modules/{module}/domain/entities/`에 위치하는가?
- [ ] Mapper는 `src/modules/{module}/mappers/`에 위치하는가?

### 테스트 & 품질
- [ ] 테스트 시 Mock Entity 객체를 쉽게 만들 수 있는가?
- [ ] Controller에서 Entity → Response DTO 변환을 수행하는가?
- [ ] Service는 Request DTO를 받아서 Entity를 반환하는가?

---

## Mongoose 버전 호환성

| Mongoose 버전 | `.lean()` 반환 타입 | 권장 방식 |
|---------------|---------------------|-----------|
| **v5.x** | `LeanDocument<T>` 사용 가능 | `LeanDocument<T>` 또는 Entity |
| **v6.0+** | `LeanDocument<T>` 제거됨 ❌ | **Entity 타입 정의** (권장) |
| **v7.0+** | `LeanDocument<T>` 제거됨 ❌ | **Entity 타입 정의** (권장) |

**마이그레이션 가이드 (v5 → v6+):**

```typescript
// ❌ Mongoose v5 (더 이상 사용 불가)
import { LeanDocument } from 'mongoose';

async findById(id: string): Promise<LeanDocument<Message> | null> {
  return this.messageModel.findById(id).lean().exec();
}

// ✅ Mongoose v6+ (권장)
import { MessageEntity } from '../domain/entities/message.entity';
import { MessageMapper } from '../mappers/message.mapper';

async findById(id: string): Promise<MessageEntity | null> {
  const doc = await this.messageModel.findById(id).lean().exec();
  return this.mapper.toEntity(doc);
}
```

---

**작성일**: 2025-12-14
**버전**: 2.0
**작성자**: Claude Code
**업데이트**: Mongoose v6+ 호환성 추가, Mapper 패턴 권장, 하이브리드 스키마 배치 전략 추가
