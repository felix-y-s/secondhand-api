import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Public } from '../../decorators/public.decorator';
import { JwtRefreshAuthGuard } from '../jwt-refresh-auth.guard';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { CurrentUser } from '../../decorators/current-user.decorator';
import type { JwtValidationResult } from '../../interfaces/jwt-payload.interface';

/**
 * Guard 테스트 전용 컨트롤러에서
 * 실제 프로덕션 코드에는 포함되지 않음
 */
@Controller('test/auth')
export class AuthGuardTestController {
  /**
   * Public 엔드포인트 - 인증 불필요
   */
  @Public()
  @Get('public')
  publicEndpoint() {
    return { message: 'public endpoint' };
  }

  /**
   * Protected 엔드포인트 - JWT Access Token 필요
   */
  @UseGuards(JwtAuthGuard)
  @Get('protected')
  protectedEndpoint(@CurrentUser() user: JwtValidationResult) {
    return {
      message: 'protected endpoint',
      user,
    };
  }

  /**
   * Refresh Token 엔드포인트
   */
  @Public()
  @UseGuards(JwtRefreshAuthGuard)
  @Post('refresh')
  refreshEndpoint(@CurrentUser() user: JwtValidationResult) {
    return {
      message: 'refresh endpoint',
      user,
    };
  }
}