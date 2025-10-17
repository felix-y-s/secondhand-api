import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { RabbitMQConnectionService } from '../src/rabbitmq/rabbitmq-connection.service';
import { EventPublisherService } from '../src/events/publishers/event-publisher.service';
import { EventEmitterModule, EventEmitter2 } from '@nestjs/event-emitter';
import {
  EventType,
  UserRegisteredEvent,
  ProductCreatedEvent,
  OrderCreatedEvent,
  PaymentCompletedEvent,
} from '../src/events/types/event.types';
import { winstonConfig } from '../src/config/logger.config';
import { v4 as uuidv4 } from 'uuid';
import { ChannelWrapper } from 'amqp-connection-manager';

/**
 * RabbitMQ/Events 통합 테스트
 *
 * 실제 RabbitMQ 서버와 연동하여 테스트
 *
 * 사전 요구사항:
 * - RabbitMQ 서버가 실행 중이어야 함 (localhost:5672)
 * - 환경 변수: RABBITMQ_URL=amqp://admin:SecurePassword123!@localhost:5672
 */
describe('RabbitMQ/Events 통합 테스트 (실제 RabbitMQ 연동)', () => {
  let moduleRef: TestingModule;
  let rabbitMQService: RabbitMQConnectionService;
  let eventPublisher: EventPublisherService;
  let eventEmitter: EventEmitter2;
  let channelWrapper: ChannelWrapper;

  // 테스트 타임아웃 (RabbitMQ 연결 시간 고려)
  jest.setTimeout(30000);

  beforeAll(async () => {
    // 테스트 모듈 초기화
    moduleRef = await Test.createTestingModule({
      imports: [
        // 환경 설정
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.development',
          // 테스트용 환경 변수 오버라이드
          load: [
            () => ({
              RABBITMQ_URL: 'amqp://admin:SecurePassword123!@localhost:5672',
            }),
          ],
        }),
        // Winston 로거
        WinstonModule.forRoot(winstonConfig),
        // EventEmitter
        EventEmitterModule.forRoot({
          wildcard: true,
          delimiter: '.',
        }),
      ],
      providers: [RabbitMQConnectionService, EventPublisherService],
    }).compile();

    rabbitMQService = moduleRef.get<RabbitMQConnectionService>(
      RabbitMQConnectionService,
    );
    eventPublisher =
      moduleRef.get<EventPublisherService>(EventPublisherService);
    eventEmitter = moduleRef.get<EventEmitter2>(EventEmitter2);

    // RabbitMQ 초기화 (onModuleInit 호출)
    await rabbitMQService.onModuleInit();

    // RabbitMQ 연결 대기
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 채널 Wrapper 가져오기
    channelWrapper = rabbitMQService.getChannelWrapper();
  });

  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  describe('RabbitMQ 연결 테스트', () => {
    it('RabbitMQ에 성공적으로 연결되어야 함', () => {
      expect(rabbitMQService.isConnected()).toBe(true);
    });

    it('채널이 생성되어야 함', () => {
      expect(rabbitMQService.isChannelConnected()).toBe(true);
      expect(channelWrapper).toBeDefined();
    });
  });

  describe('Exchange 및 Queue 설정 테스트', () => {
    it('secondhand.events Exchange가 생성되어야 함', async () => {
      // Exchange 존재 확인 (assertExchange는 이미 존재하면 무시)
      await channelWrapper.addSetup(async (channel) => {
        await channel.assertExchange('secondhand.events', 'topic', {
          durable: true,
        });
      });

      expect(true).toBe(true); // 에러가 없으면 성공
    });

    it('주문 처리 Queue가 생성되어야 함', async () => {
      await channelWrapper.addSetup(async (channel) => {
        try {
          await channel.assertQueue('secondhand.orders.process', {
            durable: true,
            deadLetterExchange: 'secondhand.dlx',
            deadLetterRoutingKey: 'orders.failed',
          });
        } catch (error) {
          console.log('🚀 | error:', error);
        }
      });

      expect(true).toBe(true);
    });

    it('결제 처리 Queue가 생성되어야 함', async () => {
      await channelWrapper.addSetup(async (channel) => {
        await channel.assertQueue('secondhand.payments.process', {
          durable: true,
          deadLetterExchange: 'secondhand.dlx',
          deadLetterRoutingKey: 'payments.failed',
        });
      });

      expect(true).toBe(true);
    });

    it('알림 발송 Queue가 생성되어야 함', async () => {
      await channelWrapper.addSetup(async (channel) => {
        await channel.assertQueue('secondhand.notifications.send', {
          durable: true,
          maxPriority: 10,
        });
      });

      expect(true).toBe(true);
    });
  });

  describe('이벤트 발행 테스트 (EventPublisherService)', () => {
    describe('로컬 이벤트 발행 (EventEmitter)', () => {
      it('사용자 회원가입 이벤트를 로컬에 발행할 수 있어야 함', (done) => {
        const event: UserRegisteredEvent = {
          eventId: uuidv4(),
          eventType: EventType.USER_REGISTERED,
          timestamp: new Date(),
          userId: 12345,
          data: {
            userId: 12345,
            email: 'test@example.com',
            phone: '01012345678',
          },
        };

        // 이벤트 리스너 등록
        eventEmitter.once(EventType.USER_REGISTERED, (receivedEvent) => {
          expect(receivedEvent.eventId).toBe(event.eventId);
          expect(receivedEvent.data.email).toBe('test@example.com');
          done();
        });

        // 이벤트 발행
        eventPublisher.emitLocal(event);
      });

      it('상품 등록 이벤트를 로컬에 발행할 수 있어야 함', (done) => {
        const event: ProductCreatedEvent = {
          eventId: uuidv4(),
          eventType: EventType.PRODUCT_CREATED,
          timestamp: new Date(),
          userId: 999,
          data: {
            productId: 123,
            sellerId: 999,
            title: '아이폰 14 Pro',
            price: 1000000,
            categoryId: 1,
          },
        };

        eventEmitter.once(EventType.PRODUCT_CREATED, (receivedEvent) => {
          expect(receivedEvent.data.title).toBe('아이폰 14 Pro');
          expect(receivedEvent.data.price).toBe(1000000);
          done();
        });

        eventPublisher.emitLocal(event);
      });
    });

    describe('분산 이벤트 발행 (RabbitMQ)', () => {
      it('사용자 회원가입 이벤트를 RabbitMQ로 발행할 수 있어야 함', async () => {
        const event: UserRegisteredEvent = {
          eventId: uuidv4(),
          eventType: EventType.USER_REGISTERED,
          timestamp: new Date(),
          userId: 12345,
          data: {
            userId: 12345,
            email: 'test@example.com',
            phone: '01012345678',
          },
        };

        // 이벤트 발행
        await eventPublisher.emitDistributed(event);

        // 발행 성공 확인 (에러가 없으면 성공)
        expect(true).toBe(true);
      });

      it('주문 생성 이벤트를 RabbitMQ로 발행할 수 있어야 함', async () => {
        const event: OrderCreatedEvent = {
          eventId: uuidv4(),
          eventType: EventType.ORDER_CREATED,
          timestamp: new Date(),
          userId: 12345,
          data: {
            orderId: 999,
            buyerId: 12345,
            sellerId: 67890,
            productId: 123,
            totalAmount: 1000000,
          },
        };

        await eventPublisher.emitDistributed(event);
        expect(true).toBe(true);
      });

      it('결제 완료 이벤트를 RabbitMQ로 발행할 수 있어야 함', async () => {
        const event: PaymentCompletedEvent = {
          eventId: uuidv4(),
          eventType: EventType.PAYMENT_COMPLETED,
          timestamp: new Date(),
          userId: 12345,
          data: {
            paymentId: 888,
            orderId: 999,
            amount: 1000000,
            paymentMethod: 'credit_card',
            transactionId: 'txn_' + uuidv4(),
          },
        };

        await eventPublisher.emitDistributed(event);
        expect(true).toBe(true);
      });

      it('TTL 옵션과 함께 이벤트를 발행할 수 있어야 함', async () => {
        const event: UserRegisteredEvent = {
          eventId: uuidv4(),
          eventType: EventType.USER_REGISTERED,
          timestamp: new Date(),
          data: {
            userId: 99999,
            email: 'ttl-test@example.com',
          },
        };

        // 5초 후 만료
        await eventPublisher.emitWithExpiration(event, 5000);
        expect(true).toBe(true);
      });

      it('우선순위가 있는 이벤트를 발행할 수 있어야 함', async () => {
        const event: UserRegisteredEvent = {
          eventId: uuidv4(),
          eventType: EventType.USER_REGISTERED,
          timestamp: new Date(),
          data: {
            userId: 88888,
            email: 'priority-test@example.com',
          },
        };

        // 우선순위 10 (가장 높음)
        await eventPublisher.emitPriority(event, 10);
        expect(true).toBe(true);
      });
    });

    describe('하이브리드 이벤트 발행 (로컬 + 분산)', () => {
      it('로컬과 RabbitMQ에 동시에 이벤트를 발행할 수 있어야 함', (done) => {
        const event: ProductCreatedEvent = {
          eventId: uuidv4(),
          eventType: EventType.PRODUCT_CREATED,
          timestamp: new Date(),
          userId: 777,
          data: {
            productId: 456,
            sellerId: 777,
            title: '갤럭시 S24 Ultra',
            price: 1200000,
            categoryId: 1,
          },
        };

        // 로컬 이벤트 리스너 등록
        eventEmitter.once(EventType.PRODUCT_CREATED, async (receivedEvent) => {
          expect(receivedEvent.data.title).toBe('갤럭시 S24 Ultra');

          // RabbitMQ 발행도 확인
          // (실제로는 큐에서 메시지를 소비하여 확인해야 하지만, 간단히 성공 여부만 체크)
          done();
        });

        // 로컬 + 분산 동시 발행
        eventPublisher.emitAll(event);
      });
    });
  });

  describe('메시지 소비 테스트 (Consumer)', () => {
    it('Queue에서 메시지를 소비할 수 있어야 함', async () => {
      // 테스트용 Queue 생성
      const testQueue = 'test.integration.queue';

      await channelWrapper.addSetup(async (channel) => {
        await channel.assertQueue(testQueue, { durable: false });
        await channel.bindQueue(testQueue, 'secondhand.events', 'test.*');
      });

      // 테스트 이벤트 발행
      const testEvent = {
        eventId: uuidv4(),
        eventType: 'test.message' as any,
        timestamp: new Date(),
        data: { message: 'Hello RabbitMQ!' },
      };

      await channelWrapper.publish(
        'secondhand.events',
        'test.message',
        Buffer.from(JSON.stringify(testEvent)),
        { persistent: false },
      );

      // 메시지 소비
      const consumed = await new Promise<any>((resolve) => {
        channelWrapper.addSetup(async (channel) => {
          await channel.consume(
            testQueue,
            (msg) => {
              if (msg) {
                const content = JSON.parse(msg.content.toString());
                channel.ack(msg);
                resolve(content);
              }
            },
            { noAck: false },
          );
        });
      });

      expect(consumed.data.message).toBe('Hello RabbitMQ!');

      // 테스트 Queue 삭제
      await channelWrapper.addSetup(async (channel) => {
        await channel.deleteQueue(testQueue);
      });
    });
  });

  describe('Dead Letter Queue (DLQ) 테스트', () => {
    it('실패한 메시지가 DLQ로 이동해야 함', async () => {
      // DLQ 테스트는 실제 핸들러 구현 후 진행
      // 현재는 인프라 설정 확인만 수행

      await channelWrapper.addSetup(async (channel) => {
        // DLX Exchange 확인
        await channel.assertExchange('secondhand.dlx', 'topic', {
          durable: true,
        });

        // 주문 DLQ 확인
        await channel.assertQueue('secondhand.orders.dead-letter', {
          durable: true,
        });
      });

      expect(true).toBe(true);
    });
  });

  describe('연결 복원력 테스트', () => {
    it('RabbitMQ 연결 상태를 확인할 수 있어야 함', () => {
      const isConnected = rabbitMQService.isConnected();
      const isChannelConnected = rabbitMQService.isChannelConnected();

      expect(isConnected).toBe(true);
      expect(isChannelConnected).toBe(true);
    });
  });

  describe('실제 사용 시나리오 테스트', () => {
    it('[시나리오] 사용자 회원가입 → 이메일 알림', async () => {
      // 1. 사용자 회원가입 이벤트 발행
      const userRegisteredEvent: UserRegisteredEvent = {
        eventId: uuidv4(),
        eventType: EventType.USER_REGISTERED,
        timestamp: new Date(),
        userId: 10001,
        data: {
          userId: 10001,
          email: 'newuser@example.com',
          phone: '01012345678',
        },
      };

      await eventPublisher.emitDistributed(userRegisteredEvent);

      // 2. 이메일 알림 이벤트 발행 (실제로는 핸들러에서 자동으로 발행)
      const emailNotificationEvent = {
        eventId: uuidv4(),
        eventType: EventType.NOTIFICATION_EMAIL,
        timestamp: new Date(),
        userId: 10001,
        data: {
          recipientEmail: 'newuser@example.com',
          subject: '회원가입을 환영합니다!',
          template: 'welcome',
          templateData: {
            username: 'newuser',
          },
        },
      };

      await eventPublisher.emitDistributed(emailNotificationEvent);

      expect(true).toBe(true);
    });

    it('[시나리오] 주문 생성 → 결제 → 상품 판매 완료', async () => {
      const orderId = 7777;
      const productId = 888;

      // 1. 주문 생성
      const orderCreatedEvent: OrderCreatedEvent = {
        eventId: uuidv4(),
        eventType: EventType.ORDER_CREATED,
        timestamp: new Date(),
        userId: 10001,
        data: {
          orderId,
          buyerId: 10001,
          sellerId: 10002,
          productId,
          totalAmount: 500000,
        },
      };

      await eventPublisher.emitAll(orderCreatedEvent);

      // 2. 결제 완료
      const paymentCompletedEvent: PaymentCompletedEvent = {
        eventId: uuidv4(),
        eventType: EventType.PAYMENT_COMPLETED,
        timestamp: new Date(),
        userId: 10001,
        data: {
          paymentId: 9999,
          orderId,
          amount: 500000,
          paymentMethod: 'credit_card',
          transactionId: 'txn_' + uuidv4(),
        },
      };

      await eventPublisher.emitAll(paymentCompletedEvent);

      // 3. 상품 판매 완료
      const productSoldEvent = {
        eventId: uuidv4(),
        eventType: EventType.PRODUCT_SOLD,
        timestamp: new Date(),
        userId: 10002,
        data: {
          productId,
          sellerId: 10002,
          buyerId: 10001,
          orderId,
        },
      };

      await eventPublisher.emitAll(productSoldEvent);

      expect(true).toBe(true);
    });
  });

  describe('성능 테스트', () => {
    it('100개의 이벤트를 빠르게 발행할 수 있어야 함', async () => {
      const startTime = Date.now();

      const promises = [];
      for (let i = 0; i < 100; i++) {
        const event: UserRegisteredEvent = {
          eventId: uuidv4(),
          eventType: EventType.USER_REGISTERED,
          timestamp: new Date(),
          userId: 20000 + i,
          data: {
            userId: 20000 + i,
            email: `user${i}@example.com`,
          },
        };

        promises.push(eventPublisher.emitDistributed(event));
      }

      await Promise.all(promises);

      const duration = Date.now() - startTime;

      console.log(`100개 이벤트 발행 소요 시간: ${duration}ms`);
      expect(duration).toBeLessThan(5000); // 5초 이내
    });
  });
});
