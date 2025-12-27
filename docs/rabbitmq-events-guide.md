# RabbitMQ/Events 통합 가이드

## 목차
1. [개요](#개요)
2. [아키텍처](#아키텍처)
3. [이벤트 타입 정의](#이벤트-타입-정의)
4. [이벤트 발행](#이벤트-발행)
5. [이벤트 구독 및 핸들러](#이벤트-구독-및-핸들러)
6. [Queue 네이밍 규칙](#queue-네이밍-규칙)
7. [실제 사용 예제](#실제-사용-예제)
8. [테스트 실행](#테스트-실행)
9. [모니터링 및 디버깅](#모니터링-및-디버깅)

---

## 개요

이 프로젝트는 **이벤트 기반 아키텍처(Event-Driven Architecture)**를 채택하여 마이크로서비스 간 느슨한 결합(Loose Coupling)을 구현합니다.

### 주요 특징

- **하이브리드 이벤트 시스템**
  - **로컬 이벤트**: 같은 프로세스 내에서 EventEmitter를 통한 빠른 통신
  - **분산 이벤트**: RabbitMQ를 통한 서비스 간 메시징

- **자동 재연결 및 복원력**
  - RabbitMQ 연결 끊김 시 자동 재연결
  - Dead Letter Queue (DLQ)를 통한 실패 메시지 처리
  - 재시도 로직 및 지수 백오프

- **도메인 기반 이벤트**
  - User, Product, Order, Payment, Notification 도메인별 이벤트
  - TypeScript 타입 안전성 보장

---

## 아키텍처

### 전체 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                        Application                               │
│  ┌───────────────┐         ┌──────────────────┐                │
│  │   Service     │────────>│ EventPublisher   │                │
│  │  (비즈니스 로직) │         │    Service       │                │
│  └───────────────┘         └──────────────────┘                │
│                                   │                              │
│                          ┌────────┴────────┐                    │
│                          │                 │                    │
│                    ┌─────▼──────┐   ┌─────▼──────┐            │
│                    │ EventEmitter│   │  RabbitMQ  │            │
│                    │   (로컬)     │   │   (분산)    │            │
│                    └─────┬──────┘   └─────┬──────┘            │
│                          │                 │                    │
│                    ┌─────▼──────┐   ┌─────▼──────┐            │
│                    │   Local    │   │  Queues    │            │
│                    │  Handlers  │   │ (비동기)    │            │
│                    └────────────┘   └────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### RabbitMQ 인프라 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                     RabbitMQ Infrastructure                      │
│                                                                   │
│  ┌──────────────────┐      ┌──────────────────┐                │
│  │   Exchange       │      │   Exchange       │                │
│  │ secondhand.events│      │ secondhand.dlx   │                │
│  │   (Topic)        │      │   (DLX)          │                │
│  └────────┬─────────┘      └────────┬─────────┘                │
│           │                          │                           │
│    ┌──────┴──────┬──────────────────┴───────┐                  │
│    │             │                           │                  │
│ ┌──▼─────────┐ ┌─▼──────────┐ ┌────────────▼───────────┐     │
│ │ orders.    │ │ payments.  │ │ orders.dead-letter     │     │
│ │ process    │ │ process    │ │ (DLQ)                  │     │
│ └────────────┘ └────────────┘ └────────────────────────┘     │
│                                                                  │
│  Routing Key Pattern:                                           │
│  - order.*     → orders.process                                 │
│  - payment.*   → payments.process                               │
│  - notification.* → notifications.send                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 이벤트 타입 정의

### 이벤트 네이밍 규칙

**패턴**: `{domain}.{action}`

- **domain**: user, product, order, payment, notification
- **action**: registered, created, updated, deleted, completed, failed 등

### 예제: 사용자 회원가입 이벤트

```typescript
import { EventType, UserRegisteredEvent } from './events/types/event.types';
import { v4 as uuidv4 } from 'uuid';

const event: UserRegisteredEvent = {
  eventId: uuidv4(),
  eventType: EventType.USER_REGISTERED,
  timestamp: new Date(),
  userId: 12345,
  data: {
    userId: 12345,
    email: 'user@example.com',
    phone: '01012345678',
  },
  metadata: {
    source: 'web',
    userAgent: 'Mozilla/5.0...',
  },
};
```

### 사용 가능한 이벤트 타입

#### 사용자 (User) 이벤트
- `USER_REGISTERED` - 회원가입
- `USER_VERIFIED` - 이메일/전화번호 인증 완료
- `USER_UPDATED` - 사용자 정보 수정
- `USER_DELETED` - 계정 삭제

#### 상품 (Product) 이벤트
- `PRODUCT_CREATED` - 상품 등록
- `PRODUCT_UPDATED` - 상품 정보 수정
- `PRODUCT_DELETED` - 상품 삭제
- `PRODUCT_RESERVED` - 상품 예약됨
- `PRODUCT_SOLD` - 판매 완료

#### 주문 (Order) 이벤트
- `ORDER_CREATED` - 주문 생성
- `ORDER_PAID` - 결제 완료
- `ORDER_PROCESSING` - 처리 중
- `ORDER_SHIPPED` - 배송 시작
- `ORDER_DELIVERED` - 배송 완료
- `ORDER_CANCELLED` - 주문 취소
- `ORDER_REFUNDED` - 환불

#### 결제 (Payment) 이벤트
- `PAYMENT_REQUESTED` - 결제 요청
- `PAYMENT_COMPLETED` - 결제 완료
- `PAYMENT_FAILED` - 결제 실패
- `PAYMENT_CANCELLED` - 결제 취소
- `PAYMENT_REFUNDED` - 환불

#### 알림 (Notification) 이벤트
- `NOTIFICATION_EMAIL` - 이메일 알림
- `NOTIFICATION_SMS` - SMS 알림
- `NOTIFICATION_PUSH` - 푸시 알림

---

## 이벤트 발행

### EventPublisherService 주입

```typescript
import { Injectable } from '@nestjs/common';
import { EventPublisherService } from './events/publishers/event-publisher.service';

@Injectable()
export class UserService {
  constructor(
    private readonly eventPublisher: EventPublisherService,
  ) {}

  async registerUser(data: CreateUserDto) {
    // 1. 사용자 등록 로직
    const user = await this.userRepository.create(data);

    // 2. 이벤트 발행
    const event: UserRegisteredEvent = {
      eventId: uuidv4(),
      eventType: EventType.USER_REGISTERED,
      timestamp: new Date(),
      userId: user.id,
      data: {
        userId: user.id,
        email: user.email,
        phone: user.phone,
      },
    };

    await this.eventPublisher.emitAll(event);

    return user;
  }
}
```

### 발행 방식

#### 1. 로컬 이벤트 발행 (같은 프로세스 내)

```typescript
// EventEmitter를 통한 빠른 통신 
this.eventPublisher.emitLocal(event);
```

**사용 시나리오**:
- 같은 애플리케이션 내에서 즉시 처리해야 하는 작업
- 빠른 응답이 필요한 경우 (예: 캐시 무효화)

#### 2. 분산 이벤트 발행 (RabbitMQ)

```typescript
// RabbitMQ를 통한 서비스 간 메시징
await this.eventPublisher.emitDistributed(event);
```

**사용 시나리오**:
- 다른 마이크로서비스에 이벤트 전달
- 비동기 처리가 필요한 작업 (예: 이메일 발송, 알림)

#### 3. 하이브리드 발행 (로컬 + 분산)

```typescript
// 로컬과 RabbitMQ 동시 발행
await this.eventPublisher.emitAll(event);
```

**사용 시나리오**:
- 로컬 처리와 분산 처리가 모두 필요한 경우
- 대부분의 도메인 이벤트에서 권장

#### 4. 우선순위 메시지 발행

```typescript
// 우선순위 10 (0-10, 10이 가장 높음)
await this.eventPublisher.emitPriority(event, 10);
```

**사용 시나리오**:
- 중요한 알림 (예: 결제 완료, 주문 취소)
- 긴급 처리가 필요한 작업

#### 5. 만료 시간이 있는 메시지

```typescript
// 5초 후 자동 만료
await this.eventPublisher.emitWithExpiration(event, 5000);
```

**사용 시나리오**:
- 시간에 민감한 이벤트 (예: 실시간 알림)
- 오래된 메시지는 처리하지 않는 경우

---

## 이벤트 구독 및 핸들러

### 이벤트 핸들러 작성

#### 1. BaseEventHandler 상속

```typescript
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BaseLocalEventHandler } from '../events/handlers/base-event.handler';
import { UserRegisteredEvent, EventType } from '../events/types/event.types';

@Injectable()
export class UserRegisteredHandler extends BaseLocalEventHandler<UserRegisteredEvent> {
  protected handlerName = 'UserRegisteredHandler';

  /**
   * 사용자 회원가입 이벤트 핸들러
   */
  @OnEvent(EventType.USER_REGISTERED)
  async handleEvent(event: UserRegisteredEvent): Promise<void> {
    await super.handleEvent(event);
  }

  /**
   * 실제 비즈니스 로직
   */
  async handle(event: UserRegisteredEvent): Promise<void> {
    // 1. 환영 이메일 발송
    await this.emailService.sendWelcomeEmail(event.data.email);

    // 2. 관리자에게 알림
    await this.notificationService.notifyAdmin('새로운 사용자 가입', {
      userId: event.data.userId,
      email: event.data.email,
    });

    // 3. 통계 업데이트
    await this.analyticsService.trackUserRegistration(event.data.userId);
  }
}
```

#### 2. 재시도 설정

```typescript
export class UserRegisteredHandler extends BaseLocalEventHandler<UserRegisteredEvent> {
  protected handlerName = 'UserRegisteredHandler';
  protected maxRetries = 5; // 최대 5회 재시도
  protected retryDelay = 2000; // 2초 지연

  // ...
}
```

#### 3. RabbitMQ Consumer 작성

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { RabbitMQConnectionService } from '../rabbitmq/rabbitmq-connection.service';

@Injectable()
export class OrderConsumer implements OnModuleInit {
  constructor(
    private readonly rabbitMQService: RabbitMQConnectionService,
  ) {}

  async onModuleInit() {
    const channel = this.rabbitMQService.getChannelWrapper();

    await channel.addSetup(async (ch) => {
      await ch.consume(
        'secondhand.orders.process',
        async (msg) => {
          if (msg) {
            try {
              const event = JSON.parse(msg.content.toString());
              
              // 주문 처리 로직
              await this.processOrder(event);
              
              // 성공 시 메시지 확인 (ACK)
              ch.ack(msg);
            } catch (error) {
              // 실패 시 메시지 거부 (DLQ로 이동)
              ch.nack(msg, false, false);
            }
          }
        },
        { noAck: false },
      );
    });
  }

  private async processOrder(event: OrderCreatedEvent) {
    // 주문 처리 로직
  }
}
```

---

## Queue 네이밍 규칙

### Exchange 네이밍

**패턴**: `secondhand.{type}`

- `secondhand.events` - 이벤트 Exchange (Topic)
- `secondhand.commands` - 명령 Exchange (Direct)
- `secondhand.dlx` - Dead Letter Exchange

### Queue 네이밍

**패턴**: `secondhand.{domain}.{purpose}`

| Queue 이름 | Routing Key | 목적 |
|-----------|-------------|------|
| `secondhand.orders.process` | `order.*` | 주문 처리 |
| `secondhand.orders.dead-letter` | `orders.failed` | 주문 실패 메시지 |
| `secondhand.payments.process` | `payment.*` | 결제 처리 |
| `secondhand.payments.dead-letter` | `payments.failed` | 결제 실패 메시지 |
| `secondhand.notifications.send` | `notification.*` | 알림 발송 (우선순위 큐) |
| `secondhand.users.process` | `user.*` | 사용자 처리 |
| `secondhand.products.process` | `product.*` | 상품 처리 |

### Routing Key 패턴

**패턴**: `{domain}.{action}`

예제:
- `order.created` - 주문 생성
- `order.paid` - 주문 결제 완료
- `payment.completed` - 결제 완료
- `user.registered` - 사용자 회원가입

---

## 실제 사용 예제

### 예제 1: 사용자 회원가입 플로우

```typescript
// 1. UserService: 사용자 등록 및 이벤트 발행
@Injectable()
export class UserService {
  async registerUser(dto: CreateUserDto) {
    // 사용자 생성
    const user = await this.userRepository.create(dto);

    // 이벤트 발행
    await this.eventPublisher.emitAll({
      eventId: uuidv4(),
      eventType: EventType.USER_REGISTERED,
      timestamp: new Date(),
      userId: user.id,
      data: {
        userId: user.id,
        email: user.email,
        phone: user.phone,
      },
    });

    return user;
  }
}

// 2. UserRegisteredHandler: 로컬 이벤트 처리
@Injectable()
export class UserRegisteredHandler extends BaseLocalEventHandler<UserRegisteredEvent> {
  @OnEvent(EventType.USER_REGISTERED)
  async handleEvent(event: UserRegisteredEvent): Promise<void> {
    await super.handleEvent(event);
  }

  async handle(event: UserRegisteredEvent): Promise<void> {
    // 환영 이메일 이벤트 발행
    await this.eventPublisher.emitPriority({
      eventId: uuidv4(),
      eventType: EventType.NOTIFICATION_EMAIL,
      timestamp: new Date(),
      userId: event.data.userId,
      data: {
        recipientEmail: event.data.email,
        subject: '회원가입을 환영합니다!',
        template: 'welcome',
        templateData: {
          userId: event.data.userId,
        },
      },
    }, 10); // 우선순위 10
  }
}

// 3. NotificationConsumer: RabbitMQ에서 메시지 소비
@Injectable()
export class NotificationConsumer implements OnModuleInit {
  async onModuleInit() {
    const channel = this.rabbitMQService.getChannelWrapper();

    await channel.addSetup(async (ch) => {
      await ch.consume(
        'secondhand.notifications.send',
        async (msg) => {
          if (msg) {
            const event = JSON.parse(msg.content.toString());
            
            if (event.eventType === EventType.NOTIFICATION_EMAIL) {
              await this.emailService.send(event.data);
            }
            
            ch.ack(msg);
          }
        },
      );
    });
  }
}
```

### 예제 2: 주문 생성 → 결제 → 상품 판매 완료

```typescript
@Injectable()
export class OrderService {
  async createOrder(dto: CreateOrderDto) {
    // 1. 주문 생성
    const order = await this.orderRepository.create(dto);

    // 2. 주문 생성 이벤트 발행
    await this.eventPublisher.emitAll({
      eventId: uuidv4(),
      eventType: EventType.ORDER_CREATED,
      timestamp: new Date(),
      userId: order.buyerId,
      data: {
        orderId: order.id,
        buyerId: order.buyerId,
        sellerId: order.sellerId,
        productId: order.productId,
        totalAmount: order.totalAmount,
      },
    });

    return order;
  }

  async processPayment(orderId: number, paymentData: PaymentData) {
    // 3. 결제 처리
    const payment = await this.paymentService.process(paymentData);

    // 4. 결제 완료 이벤트 발행
    await this.eventPublisher.emitAll({
      eventId: uuidv4(),
      eventType: EventType.PAYMENT_COMPLETED,
      timestamp: new Date(),
      userId: payment.userId,
      data: {
        paymentId: payment.id,
        orderId: orderId,
        amount: payment.amount,
        paymentMethod: payment.method,
        transactionId: payment.transactionId,
      },
    });
  }
}

// 결제 완료 핸들러
@Injectable()
export class PaymentCompletedHandler extends BaseLocalEventHandler<PaymentCompletedEvent> {
  @OnEvent(EventType.PAYMENT_COMPLETED)
  async handleEvent(event: PaymentCompletedEvent): Promise<void> {
    await super.handleEvent(event);
  }

  async handle(event: PaymentCompletedEvent): Promise<void> {
    // 5. 상품 판매 완료 처리
    const order = await this.orderRepository.findOne(event.data.orderId);
    
    await this.productRepository.update(order.productId, {
      status: 'SOLD',
      soldAt: new Date(),
    });

    // 6. 상품 판매 완료 이벤트 발행
    await this.eventPublisher.emitAll({
      eventId: uuidv4(),
      eventType: EventType.PRODUCT_SOLD,
      timestamp: new Date(),
      userId: order.sellerId,
      data: {
        productId: order.productId,
        sellerId: order.sellerId,
        buyerId: order.buyerId,
        orderId: order.id,
      },
    });
  }
}
```

### 예제 3: 우선순위가 있는 알림 처리

```typescript
@Injectable()
export class NotificationService {
  async sendUrgentNotification(userId: number, message: string) {
    // 긴급 알림 (우선순위 10)
    await this.eventPublisher.emitPriority({
      eventId: uuidv4(),
      eventType: EventType.NOTIFICATION_PUSH,
      timestamp: new Date(),
      userId: userId,
      data: {
        recipientUserId: userId,
        title: '긴급 알림',
        body: message,
        priority: 10,
      },
    }, 10);
  }

  async sendNormalNotification(userId: number, message: string) {
    // 일반 알림 (우선순위 5)
    await this.eventPublisher.emitPriority({
      eventId: uuidv4(),
      eventType: EventType.NOTIFICATION_PUSH,
      timestamp: new Date(),
      userId: userId,
      data: {
        recipientUserId: userId,
        title: '알림',
        body: message,
        priority: 5,
      },
    }, 5);
  }
}
```

---

## 테스트 실행

### 통합 테스트 실행

```bash
# RabbitMQ 서버 시작 (Docker)
npm run docker:dev:up

# 테스트 실행
npm test test/rabbitmq-events.integration.spec.ts

# 테스트 커버리지 확인
npm run test:cov
```

### 테스트 시나리오

1. **RabbitMQ 연결 테스트**
   - 연결 상태 확인
   - 채널 생성 확인

2. **Exchange 및 Queue 설정 테스트**
   - Exchange 생성 확인
   - Queue 생성 및 바인딩 확인

3. **이벤트 발행 테스트**
   - 로컬 이벤트 발행
   - 분산 이벤트 발행
   - 하이브리드 발행
   - 우선순위 메시지
   - TTL 메시지

4. **메시지 소비 테스트**
   - Queue에서 메시지 소비
   - ACK/NACK 처리

5. **Dead Letter Queue 테스트**
   - 실패한 메시지 DLQ 이동 확인

6. **실제 시나리오 테스트**
   - 사용자 회원가입 플로우
   - 주문 → 결제 → 판매 완료 플로우

7. **성능 테스트**
   - 100개 이벤트 빠른 발행

---

## 모니터링 및 디버깅

### RabbitMQ 관리 UI

```bash
# RabbitMQ Management UI 접속
# URL: http://localhost:15672
# 사용자명: rabbit
# 비밀번호: rabbit123
```

**주요 기능**:
- Exchange, Queue, Binding 현황 확인
- 메시지 흐름 모니터링
- Consumer 상태 확인
- 메시지 수동 발행/소비

### 로그 확인

```bash
# 애플리케이션 로그
tail -f logs/combined.log

# 에러 로그
tail -f logs/error.log

# Docker 로그
npm run docker:dev:logs
```

### 유용한 명령어

```bash
# Queue 메시지 수 확인
docker exec -it secondhand-rabbitmq rabbitmqctl list_queues

# Exchange 목록 확인
docker exec -it secondhand-rabbitmq rabbitmqctl list_exchanges

# Binding 확인
docker exec -it secondhand-rabbitmq rabbitmqctl list_bindings

# Consumer 상태 확인
docker exec -it secondhand-rabbitmq rabbitmqctl list_consumers
```

---

## 모범 사례 (Best Practices)

### 1. 이벤트 설계

✅ **DO**:
- 이벤트는 과거형으로 명명 (예: `USER_REGISTERED`, `ORDER_CREATED`)
- 이벤트에는 최소한의 필요한 데이터만 포함
- 이벤트 ID와 타임스탬프는 필수

❌ **DON'T**:
- 이벤트에 민감한 정보 포함 (비밀번호, 카드 번호 등)
- 이벤트를 너무 크게 만들지 않기 (1MB 이하 권장)

### 2. 이벤트 발행

✅ **DO**:
- 트랜잭션 완료 후 이벤트 발행
- 중요한 이벤트는 우선순위 설정
- 실패 시 재시도 로직 구현

❌ **DON'T**:
- 동기 작업처럼 이벤트 결과를 기다리지 않기
- 순환 이벤트 발행 (A → B → A) 주의

### 3. 이벤트 핸들러

✅ **DO**:
- 멱등성(Idempotency) 보장
- 에러 처리 및 로깅
- 재시도 로직 구현

❌ **DON'T**:
- 핸들러에서 너무 오래 걸리는 작업 수행
- 핸들러 간 의존성 생성

### 4. Queue 설계

✅ **DO**:
- DLQ 설정
- TTL 설정 (필요 시)
- 우선순위 큐 사용 (알림용)

❌ **DON'T**:
- Queue에 메시지 과도하게 쌓이지 않도록 관리
- 미사용 Queue는 삭제

---

## 트러블슈팅

### 문제 1: RabbitMQ 연결 실패

**증상**: `Error: connect ECONNREFUSED 127.0.0.1:5672`

**해결**:
```bash
# RabbitMQ 서버 시작
npm run docker:dev:up

# 연결 상태 확인
docker ps | grep rabbitmq
```

### 문제 2: 메시지가 Queue에 쌓이지 않음

**원인**: Binding이 잘못 설정됨

**해결**:
- RabbitMQ Management UI에서 Binding 확인
- Routing Key 패턴 확인

### 문제 3: Consumer가 메시지를 소비하지 않음

**원인**: Consumer가 등록되지 않았거나 에러 발생

**해결**:
```bash
# Consumer 상태 확인
docker exec -it secondhand-rabbitmq rabbitmqctl list_consumers

# 애플리케이션 로그 확인
tail -f logs/error.log
```

---

## 참고 자료

- [NestJS EventEmitter 공식 문서](https://docs.nestjs.com/techniques/events)
- [RabbitMQ 공식 문서](https://www.rabbitmq.com/documentation.html)
- [amqp-connection-manager](https://github.com/jwalton/node-amqp-connection-manager)
- [이벤트 기반 아키텍처 패턴](https://martinfowler.com/articles/201701-event-driven.html)

---

**작성일**: 2025-10-17  
**버전**: 1.0.0  
**작성자**: Secondhand API Team
