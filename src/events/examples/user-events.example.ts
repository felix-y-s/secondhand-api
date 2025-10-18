import { Injectable } from '@nestjs/common';
import { EventPublisherService } from '../publishers/event-publisher.service';
import {
  EventType,
  UserRegisteredEvent,
  UserVerifiedEvent,
} from '../types/event.types';
import { v4 as uuidv4 } from 'uuid';

/**
 * 사용자 이벤트 발행 예제
 *
 * 실제 서비스에서 사용할 수 있는 참고 예제
 */
@Injectable()
export class UserEventsExample {
  constructor(private readonly eventPublisher: EventPublisherService) {}

  /**
   * 예제 1: 사용자 회원가입 이벤트 발행
   *
   * 사용 시나리오:
   * - 사용자가 회원가입을 완료했을 때
   * - 환영 이메일 발송, 통계 업데이트, 관리자 알림 등을 트리거
   */
  async publishUserRegistered(
    userId: number,
    email: string,
    phone?: string,
  ): Promise<void> {
    const event: UserRegisteredEvent = {
      eventId: uuidv4(),
      eventType: EventType.USER_REGISTERED,
      timestamp: new Date(),
      userId: userId,
      data: {
        userId: userId,
        email: email,
        phone: phone,
      },
      metadata: {
        source: 'web', // 회원가입 경로 (web, mobile, admin 등)
        userAgent: 'Mozilla/5.0...',
      },
    };

    // 로컬 + 분산 동시 발행 (권장)
    await this.eventPublisher.emitAll(event);

    console.log(`✅ 사용자 회원가입 이벤트 발행 완료: ${userId}`);
  }

  /**
   * 예제 2: 사용자 인증 완료 이벤트 발행
   *
   * 사용 시나리오:
   * - 사용자가 이메일 또는 전화번호 인증을 완료했을 때
   * - 계정 활성화, 축하 메시지 발송 등을 트리거
   */
  async publishUserVerified(
    userId: number,
    email: string,
    verificationType: 'email' | 'phone',
  ): Promise<void> {
    const event: UserVerifiedEvent = {
      eventId: uuidv4(),
      eventType: EventType.USER_VERIFIED,
      timestamp: new Date(),
      userId: userId,
      data: {
        userId: userId,
        email: email,
        verificationType: verificationType,
      },
    };

    // 분산 이벤트 발행 (다른 서비스에서 처리)
    await this.eventPublisher.emitDistributed(event);

    console.log(
      `✅ 사용자 인증 완료 이벤트 발행: ${userId} (${verificationType})`,
    );
  }

  /**
   * 예제 3: 로컬 이벤트 발행 (빠른 처리)
   *
   * 사용 시나리오:
   * - 같은 애플리케이션 내에서 즉시 처리해야 하는 작업
   * - 캐시 무효화, 실시간 업데이트 등
   */
  async publishLocalEvent(userId: number, email: string): Promise<void> {
    const event: UserRegisteredEvent = {
      eventId: uuidv4(),
      eventType: EventType.USER_REGISTERED,
      timestamp: new Date(),
      userId: userId,
      data: {
        userId: userId,
        email: email,
      },
    };

    // 로컬 이벤트만 발행 (빠름)
    this.eventPublisher.emitLocal(event);

    console.log(`✅ 로컬 이벤트 발행 완료: ${userId}`);
  }

  /**
   * 예제 4: 우선순위가 있는 이벤트 발행
   *
   * 사용 시나리오:
   * - 중요한 알림 (예: VIP 회원 가입)
   * - 긴급 처리가 필요한 작업
   */
  async publishVipUserRegistered(userId: number, email: string): Promise<void> {
    const event: UserRegisteredEvent = {
      eventId: uuidv4(),
      eventType: EventType.USER_REGISTERED,
      timestamp: new Date(),
      userId: userId,
      data: {
        userId: userId,
        email: email,
      },
      metadata: {
        vip: true, // VIP 플래그
        priority: 10, // 최고 우선순위
      },
    };

    // 우선순위 10으로 발행
    await this.eventPublisher.emitPriority(event, 10);

    console.log(`✅ VIP 사용자 회원가입 이벤트 발행 (우선순위 10): ${userId}`);
  }

  /**
   * 예제 5: TTL이 있는 이벤트 발행
   *
   * 사용 시나리오:
   * - 시간에 민감한 이벤트 (예: 실시간 알림)
   * - 오래된 메시지는 처리하지 않는 경우
   */
  async publishTimeoutEvent(userId: number, email: string): Promise<void> {
    const event: UserRegisteredEvent = {
      eventId: uuidv4(),
      eventType: EventType.USER_REGISTERED,
      timestamp: new Date(),
      userId: userId,
      data: {
        userId: userId,
        email: email,
      },
    };

    // 10초 후 자동 만료
    await this.eventPublisher.emitWithExpiration(event, 10000);

    console.log(`✅ TTL 이벤트 발행 완료 (10초 후 만료): ${userId}`);
  }

  /**
   * 예제 6: 여러 이벤트 순차 발행
   *
   * 사용 시나리오:
   * - 회원가입 → 인증 → 프로필 설정 등 여러 단계의 이벤트
   */
  async publishMultipleEvents(
    userId: number,
    email: string,
    phone: string,
  ): Promise<void> {
    // 1. 회원가입 이벤트
    await this.publishUserRegistered(userId, email, phone);

    // 2. 인증 완료 이벤트 (2초 후)
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await this.publishUserVerified(userId, email, 'email');

    console.log(`✅ 다중 이벤트 발행 완료: ${userId}`);
  }

  /**
   * 예제 7: 에러 처리가 있는 이벤트 발행
   *
   * 사용 시나리오:
   * - 이벤트 발행 실패 시 재시도 또는 로깅
   */
  async publishWithErrorHandling(userId: number, email: string): Promise<void> {
    try {
      const event: UserRegisteredEvent = {
        eventId: uuidv4(),
        eventType: EventType.USER_REGISTERED,
        timestamp: new Date(),
        userId: userId,
        data: {
          userId: userId,
          email: email,
        },
      };

      // 최대 3회 재시도
      await this.eventPublisher.emitDistributed(event, {
        maxRetries: 3,
        persistent: true,
      });

      console.log(`✅ 이벤트 발행 성공: ${userId}`);
    } catch (error) {
      console.error(`❌ 이벤트 발행 실패: ${userId}`, error.message);

      // 실패 로깅 또는 대체 처리
      // 예: 데이터베이스에 실패 이벤트 저장
    }
  }

  /**
   * 예제 8: 조건부 이벤트 발행
   *
   * 사용 시나리오:
   * - 특정 조건에서만 이벤트 발행 (예: 비즈니스 규칙)
   */
  async publishConditionalEvent(
    userId: number,
    email: string,
    isVip: boolean,
  ): Promise<void> {
    const event: UserRegisteredEvent = {
      eventId: uuidv4(),
      eventType: EventType.USER_REGISTERED,
      timestamp: new Date(),
      userId: userId,
      data: {
        userId: userId,
        email: email,
      },
      metadata: {
        vip: isVip,
      },
    };

    // VIP 회원은 우선순위 10, 일반 회원은 기본 우선순위
    if (isVip) {
      await this.eventPublisher.emitPriority(event, 10);
      console.log(`✅ VIP 회원 이벤트 발행: ${userId}`);
    } else {
      await this.eventPublisher.emitDistributed(event);
      console.log(`✅ 일반 회원 이벤트 발행: ${userId}`);
    }
  }
}
