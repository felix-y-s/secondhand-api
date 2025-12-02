import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtValidationResult } from '../interfaces/jwt-payload.interface';

/**
 * CurrentUser 데코레이터
 *
 * JWT 인증을 통해 추출된 현재 사용자 정보를 컨트롤러에서 쉽게 접근할 수 있게 합니다.
 *
 * @example
 * ```typescript
 * @Get('profile')
 * @UseGuards(JwtAuthGuard)
 * getProfile(@CurrentUser() user: JwtValidationResult) {
 *   return { userId: user.userId, email: user.email };
 * }
 * ```
 *
 * @example 특정 필드만 추출
 * ```typescript
 * @Get('my-orders')
 * @UseGuards(JwtAuthGuard)
 * getMyOrders(@CurrentUser('userId') userId: string) {
 *   return this.ordersService.findByUserId(userId);
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtValidationResult | undefined, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user: JwtValidationResult }>();
    const user = request.user;

    // 특정 필드만 반환
    return data ? user?.[data] : user;
  },
);
