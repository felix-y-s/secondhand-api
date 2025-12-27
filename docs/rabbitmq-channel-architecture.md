# RabbitMQ 채널 아키텍처 - 최종 설계

## 📋 목차

1. [핵심 개선사항](#핵심-개선사항)
2. [아키텍처 구조](#아키텍처-구조)
3. [사용 방법](#사용-방법)
4. [주요 특징](#주요-특징)

---

## 🎯 핵심 개선사항

### 문제점 분석

**이전 구조:**
- ❌ setupInfrastructure에서 모든 Queue/Exchange/Binding 설정
- ❌ 송신 채널 풀에서 불필요한 인프라 설정 실행
- ❌ Consumer 채널 관리 미비
- ❌ 수신 채널 정리 누락 (메모리 누수)
- ❌ Exchange 생성 누락 (동적 Exchange 불가능)

**개선된 구조:**
- ✅ 송신/수신 채널 완전 분리
- ✅ 송신: 채널 풀 (빌림 → 사용 → 반환)
- ✅ 수신: 전용 채널 (생성 → 계속 점유)
- ✅ Consumer가 자율적으로 인프라 설정
- ✅ 모든 채널 추적 및 안전한 정리
- ✅ Exchange 동적 생성 지원

---

## 🏗️ 아키텍처 구조

### 1. 초기화 흐름

```
애플리케이션 시작
    ↓
RabbitMQConnectionService.connect()
    ↓
1. setupCommonExchanges() - 공통 Exchange만 생성
    ↓
2. createPublisherChannelPool() - 송신 채널 풀 생성 (인프라 설정 없음)
    ↓
초기화 완료
```

### 2. 송신 (Publisher) 흐름

```
EventPublisherService.emitDistributed()
    ↓
getPublisherChannel() - 풀에서 채널 빌림
    ↓
channel.publish() - Exchange에 메시지 발행
    ↓
releasePublisherChannel() - 풀에 즉시 반환
```

**특징:**
- 단기 실행 (1-10ms)
- Exchange만 필요 (이미 생성됨)
- 빠른 빌림/반환
- 동시성 개선

### 3. 수신 (Consumer) 흐름

```
UserEventConsumer.onModuleInit()
    ↓
createConsumerChannel() - 전용 채널 생성
    ↓
    1. Exchange 확인/생성 (멱등성)
    2. Queue 생성
    3. Exchange-Queue 바인딩
    4. Prefetch 설정
    ↓
channel.consume() - 메시지 리스닝 (계속 실행)
    ↓
    ↓ (메시지 수신)
    ↓
handleEvent() - 이벤트 처리
    ↓
channel.ack() / channel.nack() - 처리 결과 전송
```

**특징:**
- 장기 실행 (계속 리스닝)
- 전용 채널 점유
- 자율적 인프라 설정
- 자동 추적 및 정리

### 4. 종료 흐름

```
애플리케이션 종료
    ↓
Consumer.onModuleDestroy() - 각 Consumer 채널 제거
    ↓
RabbitMQConnectionService.disconnect()
    ↓
1. 모든 Consumer 채널 종료
2. 모든 Publisher 채널 종료
3. 연결 종료
    ↓
종료 완료
```

---

## 💻 사용 방법

### 1. Publisher (송신)

```typescript
// src/events/publishers/event-publisher.service.ts
@Injectable()
export class EventPublisherService {
  constructor(
    private readonly rabbitMQConnection: RabbitMQConnectionService,
  ) {}

  async emitDistributed(event: any): Promise<void> {
    // 채널 빌림
    const channel = await this.rabbitMQConnection.getPublisherChannel();

    try {
      // 메시지 발행
      await channel.publish('secondhand.events', event.eventType, ...);
    } finally {
      // 채널 반환 (반드시 실행)
      this.rabbitMQConnection.releasePublisherChannel(channel);
    }
  }
}
```

**하위 호환성:**
```typescript
// 기존 코드도 동작 (deprecated)
const channel = await this.rabbitMQConnection.getChannel();
this.rabbitMQConnection.releaseChannel(channel);
```

### 2. Consumer (수신)

```typescript
// src/events/consumers/user-event.consumer.ts
@Injectable()
export class UserEventConsumer implements OnModuleInit, OnModuleDestroy {
  private consumerChannel: ChannelWrapper;

  constructor(
    private readonly rabbitMQConnection: RabbitMQConnectionService,
  ) {}

  async onModuleInit() {
    // Consumer 전용 채널 생성 (자동 추적)
    this.consumerChannel = await this.rabbitMQConnection.createConsumerChannel({
      queueName: 'secondhand.users.process',
      exchangeName: 'secondhand.events',
      exchangeType: 'topic',
      routingKey: 'user.*',
      prefetchCount: 5,
      queueOptions: {
        durable: true,
        deadLetterExchange: 'secondhand.dlx',
        deadLetterRoutingKey: 'users.failed',
      },
    });

    // 메시지 수신 시작
    await this.startConsuming();
  }

  async onModuleDestroy() {
    // Consumer 채널 제거 (추적에서도 제거)
    await this.rabbitMQConnection.removeConsumerChannel(this.consumerChannel);
  }

  private async startConsuming(): Promise<void> {
    await this.consumerChannel.consume(
      'secondhand.users.process',
      async (msg) => {
        const event = JSON.parse(msg.content.toString());
        await this.handleEvent(event);
        this.consumerChannel.ack(msg);
      },
      { noAck: false },
    );
  }
}
```

### 3. 다양한 Consumer 패턴

#### 우선순위 큐

```typescript
this.channel = await this.rabbitMQ.createConsumerChannel({
  queueName: 'secondhand.notifications.send',
  routingKey: 'notification.*',
  queueOptions: {
    maxPriority: 10, // 우선순위 0-10
  },
});
```

#### Fanout Exchange (브로드캐스트)

```typescript
this.channel = await this.rabbitMQ.createConsumerChannel({
  queueName: 'secondhand.broadcast.listener',
  exchangeName: 'secondhand.broadcast',
  exchangeType: 'fanout', // 모든 바인딩된 Queue로 전송
  queueOptions: {
    exclusive: true, // 이 Consumer만 사용
    autoDelete: true, // Consumer 종료 시 삭제
  },
});
```

#### 여러 패턴 바인딩

```typescript
this.channel = await this.rabbitMQ.createConsumerChannel({
  queueName: 'secondhand.multi.process',
  routingKey: 'user.*', // 첫 번째 패턴
});

// 추가 바인딩
await this.channel.addSetup(async (ch) => {
  await ch.bindQueue('secondhand.multi.process', 'secondhand.events', 'order.*');
  await ch.bindQueue('secondhand.multi.process', 'secondhand.events', 'payment.*');
});
```

---

## 🚀 주요 특징

### 1. 송신/수신 완전 분리

| 구분 | 송신 (Publisher) | 수신 (Consumer) |
|------|------------------|-----------------|
| **채널 관리** | 풀 (공유) | 전용 (독립) |
| **실행 시간** | 단기 (1-10ms) | 장기 (계속 리스닝) |
| **인프라 설정** | 불필요 | 자율적 설정 |
| **사용 패턴** | 빌림 → 반환 | 생성 → 점유 |
| **동시성** | 높음 | Consumer별 독립 |

### 2. 자율적 인프라 관리

**Consumer가 직접 설정:**
- ✅ Exchange 확인/생성 (멱등성 보장)
- ✅ Queue 생성 및 옵션 설정
- ✅ Exchange-Queue 바인딩
- ✅ Prefetch, DLQ, TTL 등

**장점:**
- Consumer의 완전한 독립성
- 동적 Exchange/Queue 생성
- 유연한 설정 변경
- 명확한 책임 분리

### 3. 안전한 채널 정리

**추적 시스템:**
```typescript
// 송신 채널
publisherChannelPool: ChannelWrapper[]
publisherChannelsInUse: Set<ChannelWrapper>

// 수신 채널
consumerChannels: Set<ChannelWrapper>
```

**정리 순서:**
1. Consumer 채널 종료 (우선)
2. Publisher 채널 종료
3. 연결 종료

**메모리 누수 방지:**
- 모든 채널 추적
- 명시적 종료
- 병렬 종료로 속도 향상

### 4. 모니터링 및 디버깅

```typescript
// 채널 상태 조회
const stats = rabbitMQConnection.getChannelStats();

// 결과:
{
  publisherChannels: {
    total: 5,
    inUse: 2,
    available: 3
  },
  consumerChannels: {
    total: 3
  }
}
```

---

## 📊 비교표

| 항목 | 이전 | 개선 후 |
|------|------|---------|
| **송신 채널** | 불필요한 setup | ✅ 순수 채널 |
| **수신 채널** | 미구현 | ✅ 전용 채널 |
| **인프라 설정** | 중앙 집중 | ✅ Consumer 자율 |
| **Exchange 생성** | 고정 3개만 | ✅ 동적 생성 |
| **채널 정리** | 송신만 | ✅ 전체 정리 |
| **메모리 누수** | 가능성 있음 | ✅ 방지됨 |
| **유연성** | 낮음 | ✅ 높음 |
| **독립성** | 중앙 의존 | ✅ 완전 독립 |

---

## 🎯 결론

**완벽한 RabbitMQ 채널 관리:**

1. ✅ **송신/수신 완전 분리** - 역할에 따른 최적화
2. ✅ **Consumer 자율성** - 독립적 인프라 설정
3. ✅ **안전한 정리** - 모든 채널 추적 및 종료
4. ✅ **동적 확장** - Exchange/Queue 동적 생성
5. ✅ **하위 호환성** - 기존 코드 그대로 동작

**이제 RabbitMQ 채널이 안전하고 효율적으로 관리됩니다!** 🚀
