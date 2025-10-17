import { SetMetadata } from '@nestjs/common';

/**
 * Public 데코레이터
 *
 * 인증이 필요 없는 공개 엔드포인트를 표시합니다.
 * JwtAuthGuard가 이 데코레이터가 적용된 엔드포인트는 인증을 건너뜁니다.
 *
 * @example
 * ```typescript
 * @Public()
 * @Get('health')
 * getHealth() {
 *   return { status: 'ok' };
 * }
 * ```
 */
export const Public = () => SetMetadata('isPublic', true);
