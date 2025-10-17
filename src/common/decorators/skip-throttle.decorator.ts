import { SetMetadata } from '@nestjs/common';

/**
 * SkipThrottle 데코레이터
 *
 * Rate Limiting을 건너뛰는 엔드포인트를 표시합니다.
 * ThrottlerGuard가 전역으로 적용되어 있을 때 특정 엔드포인트를 제외할 수 있습니다.
 *
 * @example
 * ```typescript
 * @SkipThrottle()
 * @Get('health')
 * healthCheck() {
 *   return { status: 'ok' };
 * }
 * ```
 */
export const SkipThrottle = () => SetMetadata('skipThrottle', true);
