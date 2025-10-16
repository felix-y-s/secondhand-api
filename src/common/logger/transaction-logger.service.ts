import { Injectable, Inject } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

/**
 * 거래 로그 인터페이스
 * 전자상거래법 준수를 위한 거래 추적 로그
 */
export interface TransactionLog {
  /** 거래 고유 ID */
  transactionId: string;
  /** 거래 타입 */
  type: 'ORDER' | 'PAYMENT' | 'SHIPMENT' | 'REFUND';
  /** 사용자 ID */
  userId: number;
  /** 주문 ID (선택) */
  orderId?: number;
  /** 거래 금액 (선택) */
  amount?: number;
  /** 거래 상태 */
  status: string;
  /** 추가 메타데이터 (선택) */
  metadata?: Record<string, any>;
}

/**
 * 거래 전용 로거 서비스
 *
 * 중고거래 플랫폼의 모든 거래 과정을 별도 파일에 기록
 * - 법적 요구사항 준수 (전자상거래법)
 * - 분쟁 해결을 위한 증거 보전
 * - 30일 보관 정책 적용
 */
@Injectable()
export class TransactionLoggerService {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  /**
   * 거래 로그 기록 (별도 파일에 저장)
   */
  logTransaction(log: TransactionLog): void {
    const logMessage = {
      timestamp: new Date().toISOString(),
      ...log,
    };

    // 'TransactionLogger' 컨텍스트로 로깅하면 별도 파일에 저장됨
    this.logger.log(JSON.stringify(logMessage), 'TransactionLogger');
  }

  /**
   * 주문 생성 로그
   */
  logOrderCreated(orderId: number, userId: number, amount: number): void {
    this.logTransaction({
      transactionId: `ORDER-${orderId}-${Date.now()}`,
      type: 'ORDER',
      userId,
      orderId,
      amount,
      status: 'CREATED',
    });
  }

  /**
   * 결제 완료 로그
   */
  logPaymentCompleted(
    orderId: number,
    userId: number,
    amount: number,
    paymentMethod: string,
  ): void {
    this.logTransaction({
      transactionId: `PAY-${orderId}-${Date.now()}`,
      type: 'PAYMENT',
      userId,
      orderId,
      amount,
      status: 'COMPLETED',
      metadata: { paymentMethod },
    });
  }

  /**
   * 배송 시작 로그
   */
  logShipmentStarted(
    orderId: number,
    userId: number,
    trackingNumber: string,
  ): void {
    this.logTransaction({
      transactionId: `SHIP-${orderId}-${Date.now()}`,
      type: 'SHIPMENT',
      userId,
      orderId,
      status: 'STARTED',
      metadata: { trackingNumber },
    });
  }

  /**
   * 환불 로그
   */
  logRefund(
    orderId: number,
    userId: number,
    amount: number,
    reason: string,
  ): void {
    this.logTransaction({
      transactionId: `REFUND-${orderId}-${Date.now()}`,
      type: 'REFUND',
      userId,
      orderId,
      amount,
      status: 'REFUNDED',
      metadata: { reason },
    });
  }
}
