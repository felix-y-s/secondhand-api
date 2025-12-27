# 메시지 이벤트 기반 처리 가이드

## 📌 개요

메시지 발송 후 처리해야 할 여러 로직을 **이벤트 기반**으로 처리하는 시스템입니다.

### 기존 방식 vs 이벤트 기반 방식

**기존 방식 (순차적 처리):**
```typescript
private async afterMessageSent(chatRoomId: string, message: MessageEntity) {
  // 1. 마지막 메시지 업데이트
  await this.chatRoomService.updateLastMessage(chatRoomId, {...});

  // 2. 알림 전송
  await this.notificationService.sendNotification(...);

  // 3. 읽지 않은 메시지 카운트 업데이트
  await this.redisService.incrementUnreadCount(...);

  // 4. 통계 업데이트
  await this.statisticsService.updateMessageStats(...);

  // ❌ 문제점:
  // - 하나라도 실패하면 전체 실패
  // - 순차 처리로 인한 성능 저하
  // - 새로운 로직 추가 시 코드 수정 필요
  // - 각 로직 간 강한 결합
}
```

**이벤트 기반 방식 (병렬 처리):**
```typescript
private async afterMessageSent(chatRoomId: string, message: MessageEntity) {
  // 이벤트 하나만 발행
  const event: MessageSentEvent = { ... };
  this.eventPublisher.emitLocal(event);

  // ✅ 장점:
  // - 독립적인 핸들러들이 병렬 처리
  // - 한 핸들러 실패해도 다른 핸들러는 계속 실행
  // - 새로운 로직은 핸들러만 추가하면 됨
  // - 각 로직 간 느슨한 결합
  // - 재시도/에러 처리 자동화
}
```

---

## 🏗️ 시스템 구조

### 1. 이벤트 타입 정의
**위치:** `src/events/types/event.types.ts`

```typescript
export enum EventType {
  MESSAGE_SENT = 'message.sent',      // 메시지 전송 완료
  MESSAGE_READ = 'message.read',      // 메시지 읽음 처리
  MESSAGE_DELETED = 'message.deleted', // 메시지 삭제
}

export interface MessageSentEvent extends BaseEvent {
  eventType: EventType.MESSAGE_SENT;
  data: {
    messageId: string;
    chatRoomId: string;
    senderId: string;
    receiverId: string;
    message: string;
    messageType: string;
    fileUrl?: string;
    fileName?: string;
  };
}
```

### 2. 이벤트 발행
**위치:** `src/modules/messages-mongo/services/message.service.ts`

```typescript
private async afterMessageSent(chatRoomId: string, message: MessageEntity) {
  const event: MessageSentEvent = {
    eventId: uuidv4(),
    eventType: EventType.MESSAGE_SENT,
    timestamp: new Date(),
    data: {
      messageId: message.id,
      chatRoomId: chatRoomId,
      senderId: message.senderId,
      receiverId: message.receiverId,
      message: message.message,
      messageType: message.messageType,
      fileUrl: message.fileUrl,
      fileName: message.fileName,
    },
  };

  // 로컬 이벤트 발행 (같은 프로세스 내)
  this.eventPublisher.emitLocal(event);
}
```

### 3. 이벤트 핸들러
**위치:** `src/modules/messages-mongo/events/handlers/`

현재 구현된 핸들러들:

#### 3.1 마지막 메시지 업데이트 핸들러
**파일:** `update-last-message.handler.ts`

```typescript
@Injectable()
export class UpdateLastMessageHandler extends BaseLocalEventHandler<MessageSentEvent> {
  @OnEvent(EventType.MESSAGE_SENT)
  async handleEvent(event: MessageSentEvent): Promise<void> {
    // 채팅방의 마지막 메시지 업데이트
    await this.chatRoomService.updateLastMessage(...);
  }
}
```

#### 3.2 알림 전송 핸들러
**파일:** `send-message-notification.handler.ts`

```typescript
@Injectable()
export class SendMessageNotificationHandler extends BaseLocalEventHandler<MessageSentEvent> {
  @OnEvent(EventType.MESSAGE_SENT)
  async handleEvent(event: MessageSentEvent): Promise<void> {
    // 수신자에게 푸시 알림 전송
    // 이메일/SMS 알림 전송 (옵션)
  }
}
```

#### 3.3 읽지 않은 메시지 카운트 업데이트 핸들러
**파일:** `update-unread-count.handler.ts`

```typescript
@Injectable()
export class UpdateUnreadCountHandler extends BaseLocalEventHandler<MessageSentEvent> {
  @OnEvent(EventType.MESSAGE_SENT)
  async handleEvent(event: MessageSentEvent): Promise<void> {
    // Redis에서 읽지 않은 메시지 카운트 증가
  }
}
```

#### 3.4 통계 업데이트 핸들러
**파일:** `update-message-statistics.handler.ts`

```typescript
@Injectable()
export class UpdateMessageStatisticsHandler extends BaseLocalEventHandler<MessageSentEvent> {
  @OnEvent(EventType.MESSAGE_SENT)
  async handleEvent(event: MessageSentEvent): Promise<void> {
    // 일일/월별 메시지 전송 통계 업데이트
  }
}
```

---

## 🔧 새로운 핸들러 추가 방법

### 예시: 검색 인덱스 업데이트 핸들러

**1단계:** 핸들러 파일 생성

```typescript
// src/modules/messages-mongo/events/handlers/update-search-index.handler.ts
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BaseLocalEventHandler } from '@/events/handlers/base-event.handler';
import { EventType } from '@/events/types/event.types';
import type { MessageSentEvent } from '@/events/types/event.types';
import { ElasticsearchService } from '@nestjs/elasticsearch';

@Injectable()
export class UpdateSearchIndexHandler extends BaseLocalEventHandler<MessageSentEvent> {
  protected readonly handlerName = 'UpdateSearchIndexHandler';

  constructor(private readonly elasticsearchService: ElasticsearchService) {
    super();
  }

  @OnEvent(EventType.MESSAGE_SENT)
  async handleEvent(event: MessageSentEvent): Promise<void> {
    await super.handleEvent(event);
  }

  async handle(event: MessageSentEvent): Promise<void> {
    const { messageId, message } = event.data;

    // Elasticsearch 인덱스 업데이트
    await this.elasticsearchService.index({
      index: 'messages',
      id: messageId,
      body: {
        message: message,
        timestamp: event.timestamp,
      },
    });

    this.logger.log(
      `검색 인덱스 업데이트 완료: ${messageId}`,
      this.handlerName,
    );
  }
}
```

**2단계:** 모듈에 핸들러 등록

```typescript
// src/modules/messages-mongo/messages-mongo.module.ts
import { UpdateSearchIndexHandler } from './events/handlers/update-search-index.handler';

@Module({
  // ...
  providers: [
    // 기존 핸들러들
    UpdateLastMessageHandler,
    SendMessageNotificationHandler,
    UpdateUnreadCountHandler,
    UpdateMessageStatisticsHandler,
    // 새로운 핸들러 추가
    UpdateSearchIndexHandler, // ⭐ 이것만 추가하면 끝!
  ],
})
export class MessagesMongoModule {}
```

**끝!** 메시지 발송 시 자동으로 검색 인덱스가 업데이트됩니다.

---

## ⚙️ 이벤트 발행 옵션

### 1. 로컬 이벤트 발행 (기본)
같은 프로세스 내에서만 처리됩니다.

```typescript
this.eventPublisher.emitLocal(event);
```

**사용 시나리오:**
- 빠른 처리가 필요한 경우
- 같은 서버 내 처리만 필요한 경우
- 캐시 무효화, 실시간 업데이트 등

### 2. 분산 이벤트 발행
RabbitMQ를 통해 다른 서비스로도 전달됩니다.

```typescript
await this.eventPublisher.emitDistributed(event);
```

**사용 시나리오:**
- 마이크로서비스 아키텍처
- 다른 서비스에서 처리해야 하는 경우
- 이메일 발송, SMS 전송 등 외부 서비스 연동

### 3. 하이브리드 발행 (로컬 + 분산)
로컬과 분산 이벤트를 동시에 발행합니다.

```typescript
await this.eventPublisher.emitAll(event);
```

**사용 시나리오:**
- 로컬과 원격 모두 처리가 필요한 경우
- 중요한 이벤트 (중복 처리 방지)

### 4. 우선순위 이벤트 발행
긴급한 처리가 필요한 경우 우선순위를 지정합니다.

```typescript
await this.eventPublisher.emitPriority(event, 10); // 0-10, 10이 가장 높음
```

**사용 시나리오:**
- VIP 사용자 메시지
- 긴급 알림
- 중요한 트랜잭션

---

## 🛡️ 에러 처리 및 재시도

### 자동 재시도 메커니즘

모든 핸들러는 `BaseLocalEventHandler`를 상속받아 자동으로 에러 처리 및 재시도 기능을 가집니다.

```typescript
export class UpdateLastMessageHandler extends BaseLocalEventHandler<MessageSentEvent> {
  // 최대 재시도 횟수 (기본값: 3)
  protected maxRetries: number = 3;

  // 재시도 지연 시간 (기본값: 1000ms)
  protected retryDelay: number = 1000;

  // 실패 시 자동으로 재시도됩니다.
  // 1차 실패 → 1초 후 재시도
  // 2차 실패 → 2초 후 재시도
  // 3차 실패 → 4초 후 재시도
  // 최종 실패 → 에러 로깅
}
```

### 커스텀 재시도 설정

```typescript
export class CriticalHandler extends BaseLocalEventHandler<MessageSentEvent> {
  protected maxRetries: number = 5;        // 5번까지 재시도
  protected retryDelay: number = 2000;     // 2초 간격

  async handle(event: MessageSentEvent): Promise<void> {
    try {
      // 중요한 작업 처리
    } catch (error) {
      // 커스텀 에러 처리
      this.logger.error(`Critical error: ${error.message}`);
      throw error; // 재시도를 위해 에러를 다시 던짐
    }
  }
}
```

---

## 📊 실행 흐름

```
사용자 메시지 전송
    ↓
MessageService.sendMessage()
    ↓
메시지 DB 저장
    ↓
afterMessageSent() - 이벤트 발행 ⭐
    ↓
EventPublisher.emitLocal(MessageSentEvent)
    ↓
    ├─→ UpdateLastMessageHandler        (병렬)
    ├─→ SendMessageNotificationHandler  (병렬)
    ├─→ UpdateUnreadCountHandler        (병렬)
    └─→ UpdateMessageStatisticsHandler  (병렬)

각 핸들러는 독립적으로 실행됩니다.
하나가 실패해도 다른 핸들러는 계속 실행됩니다.
실패한 핸들러는 자동으로 재시도됩니다.
```

---

## ✅ 장점 정리

### 1. **확장성**
- 새로운 로직 추가 시 핸들러만 추가하면 됨
- 기존 코드 수정 불필요

### 2. **유지보수성**
- 각 로직이 독립적인 파일로 분리
- 단일 책임 원칙 준수
- 테스트 용이

### 3. **성능**
- 병렬 처리로 인한 성능 향상
- 각 핸들러가 독립적으로 실행

### 4. **안정성**
- 한 핸들러 실패가 다른 핸들러에 영향 없음
- 자동 재시도 메커니즘
- 에러 로깅 자동화

### 5. **느슨한 결합**
- MessageService는 핸들러 구현을 몰라도 됨
- 각 핸들러는 다른 핸들러를 몰라도 됨
- 도메인 로직 분리

---

## 🔍 모니터링 및 로깅

모든 이벤트 핸들러는 자동으로 로깅됩니다:

```
[UpdateLastMessageHandler] 이벤트 처리 시작: message.sent | ID: 123e4567-e89b-12d3-a456-426614174000
[UpdateLastMessageHandler] 채팅방 마지막 메시지 업데이트 완료: room-123
[UpdateLastMessageHandler] ✅ 이벤트 처리 완료: message.sent | ID: 123e4567-e89b-12d3-a456-426614174000

[SendMessageNotificationHandler] 이벤트 처리 시작: message.sent | ID: 123e4567-e89b-12d3-a456-426614174000
[SendMessageNotificationHandler] 메시지 알림 전송 완료: user-1 → user-2
[SendMessageNotificationHandler] ✅ 이벤트 처리 완료: message.sent | ID: 123e4567-e89b-12d3-a456-426614174000
```

에러 발생 시:

```
[UpdateUnreadCountHandler] ❌ 이벤트 처리 실패: message.sent | ID: 123e4567-e89b-12d3-a456-426614174000 | 오류: Redis connection failed
[UpdateUnreadCountHandler] 재시도 중 (1/3): message.sent | ID: 123e4567-e89b-12d3-a456-426614174000
```

---

## 🎯 다음 단계

1. **TODO 구현 완료**
   - `SendMessageNotificationHandler`: 실제 푸시 알림 전송 로직
   - `UpdateUnreadCountHandler`: Redis 카운트 업데이트 로직
   - `UpdateMessageStatisticsHandler`: 통계 데이터베이스 업데이트 로직

2. **추가 핸들러 구현**
   - 검색 인덱스 업데이트 (Elasticsearch)
   - 메시지 번역 (다국어 지원)
   - 스팸 필터링
   - 메시지 백업

3. **테스트 작성**
   - 각 핸들러의 단위 테스트
   - 이벤트 발행 통합 테스트
   - 재시도 로직 테스트

4. **모니터링 개선**
   - 이벤트 처리 시간 측정
   - 실패율 모니터링
   - 재시도 횟수 추적
