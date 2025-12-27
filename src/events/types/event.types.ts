/**
 * 이벤트 타입 열거형
 *
 * 네이밍 규칙: {domain}.{action}
 * - domain: user, product, order, payment, notification
 * - action: created, updated, deleted, verified, completed, failed 등
 */
export enum EventType {
  // ========================================
  // 사용자 (User) 이벤트
  // ========================================
  USER_REGISTERED = 'user.registered', // 사용자 회원가입
  USER_VERIFIED = 'user.verified', // 이메일/전화번호 인증 완료
  USER_UPDATED = 'user.updated', // 사용자 정보 수정
  USER_DELETED = 'user.deleted', // 사용자 계정 삭제

  // ========================================
  // 상품 (Product) 이벤트
  // ========================================
  PRODUCT_CREATED = 'product.created', // 상품 등록
  PRODUCT_UPDATED = 'product.updated', // 상품 정보 수정
  PRODUCT_DELETED = 'product.deleted', // 상품 삭제
  PRODUCT_RESERVED = 'product.reserved', // 상품 예약됨
  PRODUCT_SOLD = 'product.sold', // 상품 판매 완료

  // ========================================
  // 주문 (Order) 이벤트
  // ========================================
  ORDER_CREATED = 'order.created', // 주문 생성
  ORDER_PAID = 'order.paid', // 주문 결제 완료
  ORDER_PROCESSING = 'order.processing', // 주문 처리 중
  ORDER_SHIPPED = 'order.shipped', // 배송 시작
  ORDER_DELIVERED = 'order.delivered', // 배송 완료
  ORDER_CANCELLED = 'order.cancelled', // 주문 취소
  ORDER_REFUNDED = 'order.refunded', // 주문 환불

  // ========================================
  // 결제 (Payment) 이벤트
  // ========================================
  PAYMENT_REQUESTED = 'payment.requested', // 결제 요청
  PAYMENT_COMPLETED = 'payment.completed', // 결제 완료
  PAYMENT_FAILED = 'payment.failed', // 결제 실패
  PAYMENT_CANCELLED = 'payment.cancelled', // 결제 취소
  PAYMENT_REFUNDED = 'payment.refunded', // 결제 환불

  // ========================================
  // 알림 (Notification) 이벤트
  // ========================================
  NOTIFICATION_EMAIL = 'notification.email', // 이메일 알림
  NOTIFICATION_SMS = 'notification.sms', // SMS 알림
  NOTIFICATION_PUSH = 'notification.push', // 푸시 알림

  // ========================================
  // 메시지 (Message) 이벤트
  // ========================================
  MESSAGE_SENT = 'message.sent', // 메시지 전송 완료
  MESSAGE_READ = 'message.read', // 메시지 읽음 처리
  MESSAGE_DELETED = 'message.deleted', // 메시지 삭제
}

/**
 * 베이스 이벤트 인터페이스
 *
 * 모든 도메인 이벤트가 상속해야 하는 기본 구조
 */
export interface BaseEvent {
  /** 이벤트 고유 ID (UUID) */
  eventId: string;

  /** 이벤트 타입 */
  eventType: EventType;

  /** 이벤트 발생 시간 */
  timestamp: Date;

  /** 이벤트 발생시킨 사용자 ID (선택) */
  userId?: number;

  /** 이벤트 메타데이터 (선택) */
  metadata?: Record<string, any>;
}

// ============================================================
// 사용자 (User) 도메인 이벤트
// ============================================================

/**
 * 사용자 회원가입 이벤트
 */
export interface UserRegisteredEvent extends BaseEvent {
  eventType: EventType.USER_REGISTERED;
  data: {
    userId: number;
    email: string;
    phone?: string;
  };
}

/**
 * 사용자 인증 완료 이벤트
 */
export interface UserVerifiedEvent extends BaseEvent {
  eventType: EventType.USER_VERIFIED;
  data: {
    userId: number;
    email: string;
    verificationType: 'email' | 'phone';
  };
}

/**
 * 사용자 정보 수정 이벤트
 */
export interface UserUpdatedEvent extends BaseEvent {
  eventType: EventType.USER_UPDATED;
  data: {
    userId: number;
    updatedFields: string[]; // 수정된 필드 목록
  };
}

// ============================================================
// 상품 (Product) 도메인 이벤트
// ============================================================

/**
 * 상품 등록 이벤트
 */
export interface ProductCreatedEvent extends BaseEvent {
  eventType: EventType.PRODUCT_CREATED;
  data: {
    productId: number;
    sellerId: number;
    title: string;
    price: number;
    categoryId: number;
  };
}

/**
 * 상품 정보 수정 이벤트
 */
export interface ProductUpdatedEvent extends BaseEvent {
  eventType: EventType.PRODUCT_UPDATED;
  data: {
    productId: number;
    sellerId: number;
    updatedFields: string[];
  };
}

/**
 * 상품 삭제 이벤트
 */
export interface ProductDeletedEvent extends BaseEvent {
  eventType: EventType.PRODUCT_DELETED;
  data: {
    productId: number;
    sellerId: number;
  };
}

/**
 * 상품 판매 완료 이벤트
 */
export interface ProductSoldEvent extends BaseEvent {
  eventType: EventType.PRODUCT_SOLD;
  data: {
    productId: number;
    sellerId: number;
    buyerId: number;
    orderId: number;
  };
}

// ============================================================
// 주문 (Order) 도메인 이벤트
// ============================================================

/**
 * 주문 생성 이벤트
 */
export interface OrderCreatedEvent extends BaseEvent {
  eventType: EventType.ORDER_CREATED;
  data: {
    orderId: number;
    buyerId: number;
    sellerId: number;
    productId: number;
    totalAmount: number;
  };
}

/**
 * 주문 결제 완료 이벤트
 */
export interface OrderPaidEvent extends BaseEvent {
  eventType: EventType.ORDER_PAID;
  data: {
    orderId: number;
    buyerId: number;
    sellerId: number;
    totalAmount: number;
    paymentId: number;
  };
}

/**
 * 주문 취소 이벤트
 */
export interface OrderCancelledEvent extends BaseEvent {
  eventType: EventType.ORDER_CANCELLED;
  data: {
    orderId: number;
    buyerId: number;
    sellerId: number;
    reason: string;
  };
}

/**
 * 배송 완료 이벤트
 */
export interface OrderDeliveredEvent extends BaseEvent {
  eventType: EventType.ORDER_DELIVERED;
  data: {
    orderId: number;
    buyerId: number;
    sellerId: number;
    deliveredAt: Date;
  };
}

// ============================================================
// 결제 (Payment) 도메인 이벤트
// ============================================================

/**
 * 결제 완료 이벤트
 */
export interface PaymentCompletedEvent extends BaseEvent {
  eventType: EventType.PAYMENT_COMPLETED;
  data: {
    paymentId: number;
    orderId: number;
    amount: number;
    paymentMethod: string;
    transactionId: string;
  };
}

/**
 * 결제 실패 이벤트
 */
export interface PaymentFailedEvent extends BaseEvent {
  eventType: EventType.PAYMENT_FAILED;
  data: {
    orderId: number;
    amount: number;
    paymentMethod: string;
    errorCode: string;
    errorMessage: string;
  };
}

/**
 * 결제 환불 이벤트
 */
export interface PaymentRefundedEvent extends BaseEvent {
  eventType: EventType.PAYMENT_REFUNDED;
  data: {
    paymentId: number;
    orderId: number;
    amount: number;
    reason: string;
    refundedAt: Date;
  };
}

// ============================================================
// 알림 (Notification) 도메인 이벤트
// ============================================================

/**
 * 이메일 알림 이벤트
 */
export interface NotificationEmailEvent extends BaseEvent {
  eventType: EventType.NOTIFICATION_EMAIL;
  data: {
    recipientEmail: string;
    subject: string;
    template: string;
    templateData: Record<string, any>;
    priority?: number; // 0-10 (10이 가장 높음)
  };
}

/**
 * SMS 알림 이벤트
 */
export interface NotificationSmsEvent extends BaseEvent {
  eventType: EventType.NOTIFICATION_SMS;
  data: {
    recipientPhone: string;
    message: string;
    priority?: number;
  };
}

/**
 * 푸시 알림 이벤트
 */
export interface NotificationPushEvent extends BaseEvent {
  eventType: EventType.NOTIFICATION_PUSH;
  data: {
    recipientUserId: number;
    title: string;
    body: string;
    data?: Record<string, any>;
    priority?: number;
  };
}

// ============================================================
// 메시지 (Message) 도메인 이벤트
// ============================================================

/**
 * 메시지 전송 완료 이벤트
 */
export interface MessageSentEvent extends BaseEvent {
  eventType: EventType.MESSAGE_SENT;
  data: {
    chatRoomId: string;
    messageId: string;
    senderId: string;
    receiverId: string;
    message: string;
    messageType: string;
    fileUrl?: string;
    fileName?: string;
  };
}

/**
 * 메시지 읽음 처리 이벤트
 */
export interface MessageReadEvent extends BaseEvent {
  eventType: EventType.MESSAGE_READ;
  data: {
    chatRoomId: string;
    userId: string;
    readCount: number;
  };
}

/**
 * 메시지 삭제 이벤트
 */
export interface MessageDeletedEvent extends BaseEvent {
  eventType: EventType.MESSAGE_DELETED;
  data: {
    chatRoomId: string;
    deletedCount: number;
  };
}

/**
 * 모든 이벤트 타입의 유니온 타입
 */
export type DomainEvent =
  | UserRegisteredEvent
  | UserVerifiedEvent
  | UserUpdatedEvent
  | ProductCreatedEvent
  | ProductUpdatedEvent
  | ProductDeletedEvent
  | ProductSoldEvent
  | OrderCreatedEvent
  | OrderPaidEvent
  | OrderCancelledEvent
  | OrderDeliveredEvent
  | PaymentCompletedEvent
  | PaymentFailedEvent
  | PaymentRefundedEvent
  | NotificationEmailEvent
  | NotificationSmsEvent
  | NotificationPushEvent
  | MessageSentEvent
  | MessageReadEvent
  | MessageDeletedEvent;
