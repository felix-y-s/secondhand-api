import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

/**
 * JWT Refresh Token 인증 가드
 *
 * Refresh Token을 검증하여 새로운 Access Token 발급을 위한 엔드포인트를 보호합니다.
 */
@Injectable()
export class JwtRefreshAuthGuard extends AuthGuard('jwt-refresh') {
  /**
   * 인증 확인 실행
   *
   * @param context - 실행 컨텍스트
   * @returns 인증 결과
   */
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
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
    info: any, // Passport 라이브러리 내부에서 발생한 에러 (만료, 서명 오류 등)
    _context: ExecutionContext,
    _status?: any,
  ): TUser {
    // 에러가 발생했거나 사용자 정보가 없는 경우
    if (err || !user) {
      // info에 에러 정보가 있는 경우 (만료, 서명 오류 등)
      if (info instanceof Error) {
        throw new UnauthorizedException(`jwt 인증오류: ${info.message}`);
      }

      throw (
        err || new UnauthorizedException('Refresh Token이 유효하지 않습니다')
      );
    }
    return user;
  }
}
