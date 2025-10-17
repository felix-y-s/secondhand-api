/**
 * JWT 페이로드 인터페이스
 *
 * Access Token과 Refresh Token에 포함되는 사용자 정보
 */
export interface JwtPayload {
  /**
   * 사용자 ID (UUID)
   */
  sub: string;

  /**
   * 사용자 이메일
   */
  email: string;

  /**
   * 사용자 역할
   */
  role: string;

  /**
   * 토큰 발급 시간 (Unix timestamp)
   */
  iat?: number;

  /**
   * 토큰 만료 시간 (Unix timestamp)
   */
  exp?: number;

  /**
   * 토큰 타입 ('access' | 'refresh')
   */
  type?: 'access' | 'refresh';
}

/**
 * JWT 검증 결과 인터페이스
 */
export interface JwtValidationResult {
  /**
   * 사용자 ID
   */
  userId: string;

  /**
   * 사용자 이메일
   */
  email: string;

  /**
   * 사용자 역할
   */
  role: string;
}
