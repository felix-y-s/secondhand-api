import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';

/**
 * JWT 인증 가드
 *
 * Access Token을 검증하여 보호된 엔드포인트에 대한 접근을 제어합니다.
 * @Public() 데코레이터가 적용된 엔드포인트는 인증을 건너뜁니다.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  /**
   * 인증 확인 실행
   *
   * @param context - 실행 컨텍스트
   * @returns 인증 결과
   */
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // @Public() 데코레이터 확인
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    // Public 엔드포인트는 인증 생략
    if (isPublic) {
      return true;
    }

    // JWT 인증 실행
    return super.canActivate(context);
  }

  /**
   * 인증 실패 시 에러 처리
   *
   * @param err - 발생한 에러
   * @param user - 사용자 정보
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleRequest<TUser = any>(
    err: any,
    user: any,
    info: any,
    _context: ExecutionContext,
    _status?: any,
  ): TUser {
    // 에러가 발생했거나 사용자 정보가 없는 경우
    if (err || !user) {
      // info에 에러 정보가 있는 경우 (만료, 서명 오류 등)
      if (info instanceof Error) {
        throw new UnauthorizedException(`jwt 인증오류: ${info.message}`);
      }

      throw err || new UnauthorizedException('인증에 실패했습니다');
    }
    return user;
  }
}
