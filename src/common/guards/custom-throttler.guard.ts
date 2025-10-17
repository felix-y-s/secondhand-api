import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';

/**
 * 커스텀 Throttler 가드
 *
 * @SkipThrottle() 데코레이터를 지원하는 Rate Limiting 가드입니다.
 * 기본 ThrottlerGuard를 확장하여 특정 엔드포인트를 제외할 수 있습니다.
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  /**
   * Rate Limiting 적용 여부 확인
   *
   * @param context - 실행 컨텍스트
   * @returns Rate Limiting 적용 여부
   */
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const reflector = this.reflector;

    // @SkipThrottle() 데코레이터 확인
    const skipThrottle = reflector.getAllAndOverride<boolean>('skipThrottle', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipThrottle) {
      return true;
    }

    return super.shouldSkip(context);
  }
}
