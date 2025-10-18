import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import {
  JwtPayload,
  JwtValidationResult,
} from '../interfaces/jwt-payload.interface';

/**
 * JWT 인증 전략
 *
 * Access Token을 검증하고 사용자 정보를 추출합니다.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly configService: ConfigService) {
    super({
      // Authorization 헤더에서 Bearer 토큰 추출
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // 만료된 토큰 거부
      ignoreExpiration: false,
      // JWT 시크릿 키
      secretOrKey: configService.get<string>('JWT_SECRET') || 'your-secret-key',
    });
  }

  /**
   * JWT 페이로드 검증 및 사용자 정보 반환
   *
   * @param payload - JWT 페이로드
   * @returns 검증된 사용자 정보
   * @throws UnauthorizedException - 토큰이 유효하지 않은 경우
   */
  async validate(payload: JwtPayload): Promise<JwtValidationResult> {
    // 토큰 타입 검증 (Access Token만 허용)
    if (payload.type && payload.type !== 'access') {
      throw new UnauthorizedException('유효하지 않은 토큰 타입입니다');
    }

    // 필수 필드 검증
    if (!payload.sub || !payload.email || !payload.role) {
      throw new UnauthorizedException('토큰에 필수 정보가 누락되었습니다');
    }

    // 사용자 정보 반환 (req.user에 할당됨)
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
