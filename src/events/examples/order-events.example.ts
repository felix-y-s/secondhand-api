import { Injectable } from '@nestjs/common';
import { EventPublisherService } from '../publishers/event-publisher.service';
import {
  EventType,
  OrderCreatedEvent,
  OrderPaidEvent,
  PaymentCompletedEvent,
  ProductSoldEvent,
  NotificationEmailEvent,
} from '../types/event.types';
import { v4 as uuidv4 } from 'uuid';

/**
 * 주문 관련 이벤트 발행 예제
 *
 * 주문 생성 → 결제 → 상품 판매 완료 → 알림 플로우
 */
@Injectable()
export class OrderEventsExample {
  constructor(private readonly eventPublisher: EventPublisherService) {}

  /**
   * 예제 1: 주문 생성 이벤트 발행
   *
   * 사용 시나리오:
   * - 구매자가 상품 구매 버튼을 클릭했을 때
   * - 주문 정보를 생성하고 이벤트 발행
   */
  async publishOrderCreated(
    orderId: number,
    buyerId: number,
    sellerId: number,
    productId: number,
    totalAmount: number,
  ): Promise<void> {
    const event: OrderCreatedEvent = {
      eventId: uuidv4(),
      eventType: EventType.ORDER_CREATED,
      timestamp: new Date(),
      userId: buyerId,
      data: {
        orderId: orderId,
        buyerId: buyerId,
        sellerId: sellerId,
        productId: productId,
        totalAmount: totalAmount,
      },
    };

    // 로컬 + 분산 동시 발행
    await this.eventPublisher.emitAll(event);

    console.log(`✅ 주문 생성 이벤트 발행: Order ${orderId}`);
  }

  /**
   * 예제 2: 주문 결제 완료 이벤트 발행
   *
   * 사용 시나리오:
   * - 결제 게이트웨이에서 결제 성공 응답을 받았을 때
   */
  async publishOrderPaid(
    orderId: number,
    buyerId: number,
    sellerId: number,
    totalAmount: number,
    paymentId: number,
  ): Promise<void> {
    const event: OrderPaidEvent = {
      eventId: uuidv4(),
      eventType: EventType.ORDER_PAID,
      timestamp: new Date(),
      userId: buyerId,
      data: {
        orderId: orderId,
        buyerId: buyerId,
        sellerId: sellerId,
        totalAmount: totalAmount,
        paymentId: paymentId,
      },
    };

    await this.eventPublisher.emitAll(event);

    console.log(`✅ 주문 결제 완료 이벤트 발행: Order ${orderId}`);
  }

  /**
   * 예제 3: 결제 완료 이벤트 발행
   *
   * 사용 시나리오:
   * - 외부 결제 시스템(PG사)에서 결제 승인을 받았을 때
   */
  async publishPaymentCompleted(
    paymentId: number,
    orderId: number,
    amount: number,
    paymentMethod: string,
    transactionId: string,
  ): Promise<void> {
    const event: PaymentCompletedEvent = {
      eventId: uuidv4(),
      eventType: EventType.PAYMENT_COMPLETED,
      timestamp: new Date(),
      data: {
        paymentId: paymentId,
        orderId: orderId,
        amount: amount,
        paymentMethod: paymentMethod,
        transactionId: transactionId,
      },
    };

    // 우선순위 9로 발행 (중요한 이벤트)
    await this.eventPublisher.emitPriority(event, 9);

    console.log(`✅ 결제 완료 이벤트 발행: Payment ${paymentId}`);
  }

  /**
   * 예제 4: 상품 판매 완료 이벤트 발행
   *
   * 사용 시나리오:
   * - 결제가 완료되어 상품 소유권이 이전되었을 때
   */
  async publishProductSold(
    productId: number,
    sellerId: number,
    buyerId: number,
    orderId: number,
  ): Promise<void> {
    const event: ProductSoldEvent = {
      eventId: uuidv4(),
      eventType: EventType.PRODUCT_SOLD,
      timestamp: new Date(),
      userId: sellerId,
      data: {
        productId: productId,
        sellerId: sellerId,
        buyerId: buyerId,
        orderId: orderId,
      },
    };

    await this.eventPublisher.emitAll(event);

    console.log(`✅ 상품 판매 완료 이벤트 발행: Product ${productId}`);
  }

  /**
   * 예제 5: 이메일 알림 이벤트 발행
   *
   * 사용 시나리오:
   * - 구매자/판매자에게 주문 관련 이메일 발송
   */
  async publishOrderNotificationEmail(
    recipientEmail: string,
    subject: string,
    template: string,
    templateData: Record<string, any>,
  ): Promise<void> {
    const event: NotificationEmailEvent = {
      eventId: uuidv4(),
      eventType: EventType.NOTIFICATION_EMAIL,
      timestamp: new Date(),
      data: {
        recipientEmail: recipientEmail,
        subject: subject,
        template: template,
        templateData: templateData,
        priority: 8, // 주문 관련 알림은 우선순위 8
      },
    };

    // 우선순위 8로 발행
    await this.eventPublisher.emitPriority(event, 8);

    console.log(`✅ 이메일 알림 이벤트 발행: ${recipientEmail}`);
  }

  /**
   * 예제 6: 전체 주문 플로우 시뮬레이션
   *
   * 사용 시나리오:
   * - 주문 생성 → 결제 → 판매 완료 → 알림 전체 과정
   */
  async simulateOrderFlow(
    orderId: number,
    buyerId: number,
    sellerId: number,
    productId: number,
    totalAmount: number,
    buyerEmail: string,
    sellerEmail: string,
  ): Promise<void> {
    console.log(`\n🚀 주문 플로우 시작: Order ${orderId}\n`);

    // 1️⃣ 주문 생성
    await this.publishOrderCreated(
      orderId,
      buyerId,
      sellerId,
      productId,
      totalAmount,
    );

    // 2️⃣ 결제 진행 (2초 지연)
    console.log('⏳ 결제 진행 중...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const paymentId = Math.floor(Math.random() * 10000);
    const transactionId = `txn_${uuidv4()}`;

    await this.publishPaymentCompleted(
      paymentId,
      orderId,
      totalAmount,
      'credit_card',
      transactionId,
    );

    // 3️⃣ 주문 결제 완료
    await this.publishOrderPaid(
      orderId,
      buyerId,
      sellerId,
      totalAmount,
      paymentId,
    );

    // 4️⃣ 상품 판매 완료
    await this.publishProductSold(productId, sellerId, buyerId, orderId);

    // 5️⃣ 구매자에게 이메일 알림
    await this.publishOrderNotificationEmail(
      buyerEmail,
      '주문이 완료되었습니다!',
      'order-completed-buyer',
      {
        orderId: orderId,
        productId: productId,
        totalAmount: totalAmount,
      },
    );

    // 6️⃣ 판매자에게 이메일 알림
    await this.publishOrderNotificationEmail(
      sellerEmail,
      '상품이 판매되었습니다!',
      'order-completed-seller',
      {
        orderId: orderId,
        productId: productId,
        totalAmount: totalAmount,
      },
    );

    console.log(`\n✅ 주문 플로우 완료: Order ${orderId}\n`);
  }

  /**
   * 예제 7: 주문 취소 플로우
   *
   * 사용 시나리오:
   * - 구매자가 주문을 취소했을 때
   * - 환불 처리 및 알림
   */
  async publishOrderCancelled(
    orderId: number,
    buyerId: number,
    sellerId: number,
    reason: string,
  ): Promise<void> {
    const event = {
      eventId: uuidv4(),
      eventType: EventType.ORDER_CANCELLED,
      timestamp: new Date(),
      userId: buyerId,
      data: {
        orderId: orderId,
        buyerId: buyerId,
        sellerId: sellerId,
        reason: reason,
      },
    };

    // 우선순위 9로 발행 (중요한 이벤트)
    await this.eventPublisher.emitPriority(event, 9);

    console.log(`✅ 주문 취소 이벤트 발행: Order ${orderId}`);
  }

  /**
   * 예제 8: 대량 주문 이벤트 발행 (성능 테스트)
   *
   * 사용 시나리오:
   * - 성능 테스트 또는 벌크 작업
   */
  async publishBulkOrders(count: number): Promise<void> {
    console.log(`\n🚀 대량 주문 이벤트 발행 시작: ${count}개\n`);

    const startTime = Date.now();
    const promises: Array<Promise<void>> = [];

    for (let i = 0; i < count; i++) {
      const orderId = 10000 + i;
      const buyerId = 1000 + (i % 100);
      const sellerId = 2000 + (i % 50);
      const productId = 3000 + (i % 200);
      const totalAmount = Math.floor(Math.random() * 1000000) + 100000;

      promises.push(
        this.publishOrderCreated(
          orderId,
          buyerId,
          sellerId,
          productId,
          totalAmount,
        ),
      );
    }

    await Promise.all(promises);

    const duration = Date.now() - startTime;

    console.log(
      `\n✅ 대량 주문 이벤트 발행 완료: ${count}개 | 소요 시간: ${duration}ms\n`,
    );
  }
}
