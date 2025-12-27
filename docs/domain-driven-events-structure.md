# Domain-Driven 이벤트 구조 리팩토링 완료

## 📋 리팩토링 개요

**날짜**: 2025-12-28
**목적**: 이벤트 코드를 Domain-Driven 방식으로 재구조화하여 도메인 응집도 향상

## 🎯 핵심 원칙

### **"관심사의 분리" + "의존성 방향"**

- **rabbitmq/** 🔧 기술 구현 (How) - 메시징 인프라
- **common/events/** 🔄 공통 유틸리티 (Shared) - 재사용 가능한 이벤트 도구
- **modules/{domain}/events/** 💼 비즈니스 로직 (What) - 도메인 특화 이벤트

## 📂 최종 구조

```
src/
├── common/
│   └── events/                              # ✅ 공통 이벤트 유틸리티
│       ├── event-publisher.service.ts       # 이벤트 발행 서비스
│       ├── base-event.handler.ts            # 베이스 핸들러
│       ├── types/
│       │   └── event.types.ts               # 모든 도메인 이벤트 타입
│       └── index.ts                         # 통합 export
│
├── modules/
│   ├── users/
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   └── events/                          # ✅ User 도메인 이벤트
│       │   ├── user-event.consumer.ts       # User RabbitMQ Consumer
│       │   └── index.ts
│   │
│   ├── messages-mongo/
│   │   └── events/
│   │       └── handlers/                    # ✅ Message 로컬 이벤트 핸들러
│   │           ├── update-unread-count.handler.ts
│   │           └── ...
│   │
│   └── notifications/
│       └── listeners/                       # ✅ Notification 로컬 이벤트 리스너
│           └── message.listener.ts
│
├── rabbitmq/                                # ✅ 순수 메시징 인프라
│   ├── rabbitmq-connection.service.ts
│   ├── types/
│   │   └── channel.types.ts
│   └── rabbitmq.module.ts
│
└── events/                                  # ✅ Global 이벤트 모듈
    └── events.module.ts                     # EventEmitter 설정
```

## 🔄 변경 사항

### Before (이전 구조)
```
src/events/
├── consumers/
│   └── user-event.consumer.ts               # ❌ User 도메인이지만 별도 폴더
├── publishers/
│   └── event-publisher.service.ts           # ❌ 공통인데 events/에
├── handlers/
│   └── base-event.handler.ts                # ❌ 공통인데 events/에
└── types/
    └── event.types.ts                       # ❌ 공통인데 events/에
```

### After (개선 후)
```
src/
├── common/events/                           # ✅ 공통 코드 분리
│   ├── event-publisher.service.ts
│   ├── base-event.handler.ts
│   └── types/event.types.ts
│
└── modules/users/events/                    # ✅ User 도메인에 통합
    └── user-event.consumer.ts
```

## 📊 파일 이동 내역

| 이전 위치 | 새 위치 | 이유 |
|----------|---------|------|
| `events/publishers/event-publisher.service.ts` | `common/events/event-publisher.service.ts` | 모든 도메인에서 재사용 |
| `events/handlers/base-event.handler.ts` | `common/events/base-event.handler.ts` | 모든 핸들러의 베이스 클래스 |
| `events/types/event.types.ts` | `common/events/types/event.types.ts` | 모든 도메인 이벤트 타입 정의 |
| `events/consumers/example-user-event.consumer.ts` | `modules/users/events/user-event.consumer.ts` | User 도메인 비즈니스 로직 |

## 🔍 파일별 역할

### **common/events/** - 공통 이벤트 유틸리티

#### `event-publisher.service.ts`
```typescript
// 모든 도메인에서 사용하는 이벤트 발행 서비스
@Injectable()
export class EventPublisherService {
  emitLocal<T>(event: T): void { ... }           // 로컬 이벤트 발행
  emitDistributed<T>(event: T): Promise<void> { ... }  // RabbitMQ 발행
  emitAll<T>(event: T): Promise<void> { ... }    // 로컬 + 분산 동시
}
```

#### `base-event.handler.ts`
```typescript
// 모든 이벤트 핸들러의 베이스 클래스
export abstract class BaseEventHandler<T extends BaseEvent> {
  abstract handle(event: T): Promise<void>;
  // 공통: 로깅, 에러 처리, 재시도 로직
}

export abstract class BaseLocalEventHandler<T> extends BaseEventHandler<T> {
  // NestJS @OnEvent 데코레이터와 함께 사용
}
```

#### `types/event.types.ts`
```typescript
// 모든 도메인 이벤트 타입 정의
export enum EventType { ... }
export interface BaseEvent { ... }
export interface UserRegisteredEvent extends BaseEvent { ... }
export interface OrderCreatedEvent extends BaseEvent { ... }
// ... 모든 도메인 이벤트
```

### **modules/users/events/** - User 도메인 이벤트

#### `user-event.consumer.ts`
```typescript
// User 도메인의 RabbitMQ Consumer
@Injectable()
export class UserEventConsumer implements OnModuleInit, OnModuleDestroy {
  private consumerChannel: ChannelWrapper;

  async onModuleInit() {
    this.consumerChannel = await this.rabbitMQConnection.createConsumerChannel({
      queueName: 'secondhand.users.process',
      routingKey: 'user.*',  // user.created, user.updated 등
    });
  }

  private async handleUserEvent(event: any): Promise<void> {
    // ✅ User 도메인 비즈니스 로직
    switch (event.eventType) {
      case 'user.created': ...
      case 'user.updated': ...
    }
  }
}
```

### **rabbitmq/** - 메시징 인프라

#### `rabbitmq-connection.service.ts`
```typescript
// 순수 RabbitMQ 인프라 코드
@Injectable()
export class RabbitMQConnectionService {
  async connect(): Promise<void> { ... }
  async getPublisherChannel(): Promise<ChannelWrapper> { ... }
  async createConsumerChannel(options): Promise<ChannelWrapper> { ... }
}
```

## 🎯 분리 기준

### ✅ **common/events/**에 들어가는 것
- 여러 도메인에서 재사용되는 코드
- 이벤트 발행 추상화
- 베이스 핸들러 클래스
- 공통 이벤트 타입 정의

### ✅ **modules/{domain}/events/**에 들어가는 것
- 특정 도메인의 비즈니스 로직
- 도메인 특화 이벤트 Consumer
- 도메인 특화 이벤트 Handler

### ✅ **rabbitmq/**에 들어가는 것
- RabbitMQ 연결 관리
- 채널 풀링
- 저수준 AMQP 프로토콜 처리

## 📝 사용 가이드

### 1. 공통 이벤트 발행 (모든 도메인)

```typescript
import { EventPublisherService } from '@/common/events';

@Injectable()
export class UsersService {
  constructor(private readonly eventPublisher: EventPublisherService) {}

  async createUser(data: CreateUserDto) {
    const user = await this.repository.create(data);

    // 로컬 이벤트 발행
    this.eventPublisher.emitLocal({
      eventType: EventType.USER_REGISTERED,
      eventId: uuid(),
      timestamp: new Date(),
      data: { userId: user.id, email: user.email },
    });

    // 또는 분산 이벤트 발행 (RabbitMQ)
    await this.eventPublisher.emitDistributed({ ... });
  }
}
```

### 2. 도메인 이벤트 Consumer 추가

새로운 도메인에 이벤트 Consumer를 추가하는 방법:

```typescript
// src/modules/orders/events/order-event.consumer.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RabbitMQConnectionService } from '@/rabbitmq/rabbitmq-connection.service';
import { ChannelWrapper } from 'amqp-connection-manager';

@Injectable()
export class OrderEventConsumer implements OnModuleInit, OnModuleDestroy {
  private consumerChannel: ChannelWrapper;

  constructor(private readonly rabbitMQConnection: RabbitMQConnectionService) {}

  async onModuleInit() {
    this.consumerChannel = await this.rabbitMQConnection.createConsumerChannel({
      queueName: 'secondhand.orders.process',
      exchangeName: 'secondhand.events',
      exchangeType: 'topic',
      routingKey: 'order.*',
      prefetchCount: 5,
      queueOptions: {
        durable: true,
        deadLetterExchange: 'secondhand.dlx',
        deadLetterRoutingKey: 'orders.failed',
      },
    });

    await this.startConsuming();
  }

  async onModuleDestroy() {
    if (this.consumerChannel) {
      await this.rabbitMQConnection.removeConsumerChannel(this.consumerChannel);
    }
  }

  private async startConsuming(): Promise<void> {
    await this.consumerChannel.consume(
      'secondhand.orders.process',
      async (msg) => {
        const event = JSON.parse(msg.content.toString());
        await this.handleOrderEvent(event);
        this.consumerChannel.ack(msg);
      },
    );
  }

  private async handleOrderEvent(event: any): Promise<void> {
    // Order 도메인 비즈니스 로직
    switch (event.eventType) {
      case 'order.created':
        // 주문 생성 처리
        break;
      case 'order.paid':
        // 결제 완료 처리
        break;
    }
  }
}
```

그리고 모듈에 등록:

```typescript
// src/modules/orders/orders.module.ts
import { Module } from '@nestjs/common';
import { RabbitMQModule } from '@/rabbitmq/rabbitmq.module';
import { OrderEventConsumer } from './events';

@Module({
  imports: [RabbitMQModule],
  providers: [OrdersService, OrderEventConsumer],
})
export class OrdersModule {}
```

### 3. 로컬 이벤트 핸들러 추가

```typescript
// src/modules/notifications/events/order-notification.handler.ts
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BaseLocalEventHandler, OrderCreatedEvent } from '@/common/events';

@Injectable()
export class OrderNotificationHandler extends BaseLocalEventHandler<OrderCreatedEvent> {
  protected readonly handlerName = 'OrderNotificationHandler';

  @OnEvent('order.created')
  async handleEvent(event: OrderCreatedEvent): Promise<void> {
    await this.execute(event, this.logger);
  }

  async handle(event: OrderCreatedEvent): Promise<void> {
    // 주문 생성 알림 발송
    console.log(`주문 생성 알림: ${event.data.orderId}`);
  }
}
```

## ✅ 장점

1. **도메인 응집도 향상**: User 관련 모든 코드가 `modules/users/`에
2. **명확한 책임 분리**: 인프라(rabbitmq), 공통(common/events), 도메인(modules)
3. **쉬운 코드 탐색**: User 작업 시 `modules/users/` 폴더만 확인
4. **팀 소유권 명확**: User 팀이 `modules/users/` 전체 관리
5. **확장성**: 새 도메인 추가 시 독립적으로 작업 가능

## 🎯 다음 단계

### 추가 도메인 이벤트 구현 예정
- `modules/orders/events/` - Order 도메인 이벤트
- `modules/products/events/` - Product 도메인 이벤트
- `modules/payments/events/` - Payment 도메인 이벤트 (필요 시)

### 개선 사항
- 이벤트 타입을 도메인별로 분리 (선택적)
- Dead Letter Queue 핸들러 추가
- 이벤트 메트릭 및 모니터링 추가
