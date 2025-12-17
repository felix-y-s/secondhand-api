# plainToInstance 사용 가이드

**태그**: `#class-transformer` `#plainToInstance` `#DTO` `#Entity` `#NestJS` `#타입변환` `#데코레이터` `#API응답` `#데이터변환`

> NestJS에서 plainToInstance를 언제 사용해야 하는지, 언제 사용하지 말아야 하는지에 대한 실무 가이드

---

## 목차
1. [plainToInstance란?](#plaintoinstance란)
2. [언제 필요한가?](#언제-필요한가)
3. [언제 불필요한가?](#언제-불필요한가)
4. [실무 시나리오별 권장사항](#실무-시나리오별-권장사항)
5. [비교 정리](#비교-정리)

---

## plainToInstance란?

`class-transformer` 라이브러리의 함수로, **Plain Object를 Class Instance로 변환**하는 역할을 합니다.

```typescript
import { plainToInstance } from 'class-transformer';

// Plain Object
const plainObject = {
  id: '1',
  name: 'test',
  createdAt: new Date(),
};

// Class Instance로 변환
const instance = plainToInstance(UserDto, plainObject);
```

**주요 기능:**
- `@Transform`, `@Expose`, `@Exclude` 등 데코레이터 적용
- 타입 변환 및 검증
- 필드 제외/포함 제어

---

## 언제 필요한가?

### ✅ 1. class-transformer 데코레이터 사용 시

```typescript
// dto/message-response.dto.ts
import { Expose, Transform } from 'class-transformer';

export class MessageResponseDto {
  @Expose()
  id: string;

  @Expose()
  content: string;

  @Expose()
  @Transform(({ value }) => value?.toISOString())  // ✅ 날짜 변환
  createdAt: string;

  // messageType은 제외
}

// Controller
@Get('room/:chatRoomId')
async getMessagesByRoomId(
  @Param('chatRoomId') chatRoomId: string,
  @Query() paginationDto: PaginationDto,
): Promise<PaginatedResult<MessageResponseDto>> {
  const result = await this.messagesService.getMessagesByRoomId(chatRoomId, paginationDto);

  // ✅ class-transformer 데코레이터 적용하려면 필요
  return {
    items: plainToInstance(MessageResponseDto, result.items),
    meta: result.meta,
  };
}
```

**사용 이유:**
- `@Transform` 데코레이터로 데이터 변환 필요
- `@Expose` 데코레이터로 필드 명시적 포함
- Class Instance 메서드 사용 필요

---

### ✅ 2. 필드 제외/포함 제어가 필요할 때

```typescript
import { Exclude, Expose } from 'class-transformer';

export class MessageResponseDto {
  @Expose()
  id: string;

  @Expose()
  content: string;

  @Exclude()  // ✅ API 응답에서 제외
  isDeleted: boolean;

  @Exclude()  // ✅ API 응답에서 제외
  internalFlag: string;
}

// plainToInstance 사용해야 @Exclude 적용됨
return {
  items: plainToInstance(MessageResponseDto, result.items, {
    excludeExtraneousValues: true,  // @Expose만 포함
  }),
  meta: result.meta,
};
```

**사용 이유:**
- 민감한 정보 제외 (비밀번호, 내부 플래그 등)
- API 스펙에 필요한 필드만 선택적 노출
- 보안 강화

---

### ✅ 3. 데이터 변환이 필요할 때

```typescript
export class MessageResponseDto {
  @Transform(({ value }) => value.toString())
  id: string;  // ObjectId → string

  @Transform(({ value }) => value.toUpperCase())
  messageType: string;  // text → TEXT

  @Transform(({ obj }) => obj.sender?.username)
  senderName: string;  // sender.username 추출

  @Transform(({ value }) => value?.toISOString())
  createdAt: string;  // Date → ISO string

  @Transform(({ obj }) => obj.conversationId)
  roomId: string;  // conversationId → roomId 필드명 변경
}

// Controller
return {
  items: plainToInstance(MessageResponseDto, result.items),
  meta: result.meta,
};
```

**사용 이유:**
- 날짜 형식 변환 (Date → ISO string)
- 필드명 변경 (conversationId → roomId)
- 중첩 객체 평탄화 (sender.username → senderName)
- 대소문자 변환, 숫자 포맷팅 등

---

## 언제 불필요한가?

### ❌ 1. Plain Object를 그대로 반환하는 경우

```typescript
// Entity가 이미 Plain Object (interface/type)
export interface MessageEntity {
  id: string;
  content: string;
  createdAt: Date;
}

// Controller
@Get('room/:chatRoomId')
async getMessagesByRoomId(
  @Param('chatRoomId') chatRoomId: string,
  @Query() paginationDto: PaginationDto,
): Promise<PaginatedResult<MessageEntity>> {
  // ✅ plainToInstance 불필요
  // Entity가 이미 필요한 형태
  return this.messagesService.getMessagesByRoomId(chatRoomId, paginationDto);
}
```

**불필요한 이유:**
- Entity가 이미 Plain Object
- Repository Mapper가 변환 완료
- 추가 변환 로직 없음

---

### ❌ 2. class-transformer 데코레이터를 사용하지 않는 경우

```typescript
// dto/message-response.dto.ts
export class MessageResponseDto {
  id: string;
  content: string;
  createdAt: Date;

  // class-transformer 데코레이터 없음
  // 그냥 타입 정의만
}

// ❌ plainToInstance 불필요
// 타입 체크만 필요하면 그냥 반환
return result;
```

**불필요한 이유:**
- 데코레이터 미사용
- 타입 정의만 있음
- TypeScript 타입 체크만으로 충분

---

### ❌ 3. Repository에서 Mapper로 이미 변환한 경우

```typescript
// Repository에서 Mapper 사용
class MessageRepositoryMongo {
  constructor(private mapper: MessageMapper) {}

  async findMessagesByRoomId(
    chatRoomId: string,
    pagination: Required<PaginationOptions>,
  ): Promise<PaginatedResult<MessageEntity>> {
    const [items, total] = await Promise.all([...]);

    // ✅ Mapper가 이미 Entity로 변환
    const entities = this.mapper.toEntities(items);

    return PaginationUtil.paginate(entities, total, pagination);
  }
}

// Controller
@Get('room/:chatRoomId')
async getMessagesByRoomId(
  @Param('chatRoomId') chatRoomId: string,
  @Query() paginationDto: PaginationDto,
): Promise<PaginatedResult<MessageEntity>> {
  // ❌ plainToInstance 불필요
  // Mapper가 이미 변환했음
  return this.messagesService.getMessagesByRoomId(chatRoomId, paginationDto);
}
```

**불필요한 이유:**
- Repository Mapper가 이미 변환
- 중복 변환 불필요
- 성능 낭비

---

## 실무 시나리오별 권장사항

### 시나리오 1: Entity 그대로 반환 (가장 일반적)

```typescript
// domain/entities/message.entity.ts
export interface MessageEntity {
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

// Repository
class MessageRepositoryMongo {
  async findMessagesByRoomId(
    chatRoomId: string,
    pagination: Required<PaginationOptions>,
  ): Promise<PaginatedResult<MessageEntity>> {
    const [items, total] = await Promise.all([...]);
    const entities = this.mapper.toEntities(items);  // Mapper 변환
    return PaginationUtil.paginate(entities, total, pagination);
  }
}

// Controller
@Get('room/:chatRoomId')
async getMessagesByRoomId(
  @Param('chatRoomId') chatRoomId: string,
  @Query() paginationDto: PaginationDto,
): Promise<PaginatedResult<MessageEntity>> {
  // ✅ plainToInstance 불필요
  return this.messagesService.getMessagesByRoomId(chatRoomId, paginationDto);
}
```

**판단 기준:**
- Repository Mapper 사용? ✅
- class-transformer 데코레이터 사용? ❌
- 추가 변환 필요? ❌

**결론: plainToInstance 불필요** ❌

---

### 시나리오 2: ResponseDto 사용 + 변환 로직 필요

```typescript
// dto/message-response.dto.ts
import { Expose, Transform, Exclude } from 'class-transformer';

export class MessageResponseDto {
  @Expose()
  id: string;

  @Expose()
  @Transform(({ obj }) => obj.conversationId)
  roomId: string;  // conversationId → roomId 이름 변경

  @Expose()
  content: string;

  @Expose()
  @Transform(({ value }) => value?.toISOString())
  createdAt: string;  // Date → ISO string

  @Exclude()
  isDeleted: boolean;  // 제외

  @Exclude()
  internalFlag: string;  // 제외
}

// Controller
@Get('room/:chatRoomId')
async getMessagesByRoomId(
  @Param('chatRoomId') chatRoomId: string,
  @Query() paginationDto: PaginationDto,
): Promise<PaginatedResult<MessageResponseDto>> {
  const result = await this.messagesService.getMessagesByRoomId(chatRoomId, paginationDto);

  // ✅ plainToInstance 필요 (class-transformer 데코레이터 적용)
  return {
    items: plainToInstance(MessageResponseDto, result.items, {
      excludeExtraneousValues: true,  // @Expose만 포함
    }),
    meta: result.meta,
  };
}
```

**판단 기준:**
- class-transformer 데코레이터 사용? ✅
- 필드 변환 필요? ✅ (Date → string)
- 필드명 변경 필요? ✅ (conversationId → roomId)
- 필드 제외 필요? ✅ (isDeleted, internalFlag)

**결론: plainToInstance 필요** ✅

---

### 시나리오 3: 간단한 필드 선택만 필요

```typescript
// dto/message-response.dto.ts
export class MessageResponseDto {
  id: string;
  content: string;
  createdAt: Date;

  // 데코레이터 없음

  static fromEntity(entity: MessageEntity): MessageResponseDto {
    return {
      id: entity.id,
      content: entity.content,
      createdAt: entity.createdAt,
      // 필요한 필드만 선택
    };
  }
}

// Controller
@Get('room/:chatRoomId')
async getMessagesByRoomId(
  @Param('chatRoomId') chatRoomId: string,
  @Query() paginationDto: PaginationDto,
): Promise<PaginatedResult<MessageResponseDto>> {
  const result = await this.messagesService.getMessagesByRoomId(chatRoomId, paginationDto);

  // ✅ plainToInstance 불필요
  // 정적 메서드로 변환
  return {
    items: result.items.map(entity => MessageResponseDto.fromEntity(entity)),
    meta: result.meta,
  };
}
```

**판단 기준:**
- class-transformer 데코레이터 사용? ❌
- 정적 팩토리 메서드 사용? ✅
- 간단한 필드 선택만? ✅

**결론: plainToInstance 불필요** ❌

---

## 비교 정리

### 의사결정 플로우차트

```
plainToInstance 사용 여부?
    ↓
class-transformer 데코레이터 사용?
    ├─ YES → plainToInstance 사용 ✅
    │
    └─ NO
        ↓
    데이터 변환 필요?
        ├─ YES → plainToInstance 사용 ✅
        │
        └─ NO
            ↓
        필드 제외/포함 제어 필요?
            ├─ YES → plainToInstance 사용 ✅
            │
            └─ NO → plainToInstance 불필요 ❌
```

### 상황별 비교표

| 상황 | plainToInstance | 이유 |
|------|----------------|------|
| **Entity 그대로 반환** | ❌ 불필요 | Mapper가 이미 변환 |
| **class-transformer 데코레이터 사용** | ✅ 필요 | 데코레이터 적용 위해 |
| **필드 제외/포함 제어** | ✅ 필요 | @Exclude, @Expose 적용 |
| **데이터 변환 필요** | ✅ 필요 | @Transform 적용 |
| **날짜 형식 변환** | ✅ 필요 | Date → ISO string |
| **필드명 변경** | ✅ 필요 | conversationId → roomId |
| **Plain Object → Plain Object** | ❌ 불필요 | 타입만 맞으면 됨 |
| **Repository Mapper 사용** | ❌ 불필요 | 중복 변환 |
| **정적 팩토리 메서드 사용** | ❌ 불필요 | 명시적 변환 |

### 체크리스트

**plainToInstance 사용 전 확인:**

- [ ] `@Transform` 데코레이터로 데이터 변환 필요한가?
- [ ] `@Exclude` 데코레이터로 필드 제외 필요한가?
- [ ] `@Expose` 데코레이터로 필드 명시적 포함 필요한가?
- [ ] 날짜 형식 변환 필요한가? (Date → ISO string)
- [ ] 필드명 변경 필요한가? (conversationId → roomId)
- [ ] 중첩 객체 평탄화 필요한가? (sender.username → senderName)

**하나라도 해당하면:** ✅ plainToInstance 사용

**모두 해당 없으면:** ❌ plainToInstance 불필요

---

## 실무 권장 패턴

### 권장 패턴 1: Entity 직접 반환 (가장 일반적)

```typescript
// ✅ Repository Mapper로 변환 완료
// ✅ class-transformer 데코레이터 미사용
// ✅ 추가 변환 불필요

@Get('room/:chatRoomId')
async getMessagesByRoomId(
  @Param('chatRoomId') chatRoomId: string,
  @Query() paginationDto: PaginationDto,
): Promise<PaginatedResult<MessageEntity>> {
  return this.messagesService.getMessagesByRoomId(chatRoomId, paginationDto);
}
```

**장점:**
- 간단하고 명확
- 성능 최적화
- 중복 변환 없음

---

### 권장 패턴 2: ResponseDto + class-transformer

```typescript
// ✅ class-transformer 데코레이터 사용
// ✅ 필드 변환 및 제외 필요
// ✅ API 스펙 제어 필요

@Get('room/:chatRoomId')
async getMessagesByRoomId(
  @Param('chatRoomId') chatRoomId: string,
  @Query() paginationDto: PaginationDto,
): Promise<PaginatedResult<MessageResponseDto>> {
  const result = await this.messagesService.getMessagesByRoomId(chatRoomId, paginationDto);

  return {
    items: plainToInstance(MessageResponseDto, result.items, {
      excludeExtraneousValues: true,
    }),
    meta: result.meta,
  };
}
```

**장점:**
- 강력한 변환 기능
- 보안 강화 (필드 제외)
- API 스펙 정밀 제어

---

### 권장 패턴 3: 정적 팩토리 메서드

```typescript
// ✅ class-transformer 미사용
// ✅ 명시적 변환 로직
// ✅ 간단한 필드 선택

@Get('room/:chatRoomId')
async getMessagesByRoomId(
  @Param('chatRoomId') chatRoomId: string,
  @Query() paginationDto: PaginationDto,
): Promise<PaginatedResult<MessageResponseDto>> {
  const result = await this.messagesService.getMessagesByRoomId(chatRoomId, paginationDto);

  return {
    items: result.items.map(entity => MessageResponseDto.fromEntity(entity)),
    meta: result.meta,
  };
}
```

**장점:**
- 명시적 변환 로직
- 타입 안전성
- 디버깅 용이

---

## 핵심 원칙

### 원칙 1: 중복 변환 방지
```typescript
// ❌ 중복 변환
Repository Mapper → Entity
    ↓
Controller plainToInstance → DTO

// ✅ 단일 변환
Repository Mapper → Entity → Controller 반환
```

### 원칙 2: 필요할 때만 사용
```typescript
// plainToInstance는 비용이 있음
// - 메모리 할당
// - 타입 변환
// - 데코레이터 처리

// 필요 없으면 사용하지 말 것!
```

### 원칙 3: 명시적 변환 선호
```typescript
// ✅ 명시적 (정적 팩토리 메서드)
MessageResponseDto.fromEntity(entity)

// vs

// ⚠️ 암시적 (plainToInstance)
plainToInstance(MessageResponseDto, entity)
```

---

## 문제 해결

### 문제 1: plainToInstance 후에도 데코레이터 미적용

```typescript
// ❌ 데코레이터가 적용 안 됨
const dto = plainToInstance(MessageResponseDto, plainObject);
```

**해결:**
```typescript
// ✅ excludeExtraneousValues 옵션 추가
const dto = plainToInstance(MessageResponseDto, plainObject, {
  excludeExtraneousValues: true,  // @Expose만 포함
});
```

### 문제 2: 순환 참조 에러

```typescript
// ❌ 순환 참조
export class UserDto {
  @Type(() => MessageDto)
  messages: MessageDto[];
}

export class MessageDto {
  @Type(() => UserDto)
  sender: UserDto;  // 순환!
}
```

**해결:**
```typescript
// ✅ 순환 참조 제거
export class MessageDto {
  senderId: string;  // ID만 포함
  senderName: string;  // 필요한 정보만
}
```

### 문제 3: 성능 문제 (대량 데이터)

```typescript
// ❌ 느림 (10,000개 아이템)
const dtos = plainToInstance(MessageDto, items);
```

**해결:**
```typescript
// ✅ 정적 팩토리 메서드 사용 (더 빠름)
const dtos = items.map(item => MessageDto.fromEntity(item));

// 또는

// ✅ Repository Mapper에서 변환 (가장 빠름)
// Entity 그대로 반환
```

---

**작성일**: 2025-12-14
**버전**: 1.0
**작성자**: Claude Code
