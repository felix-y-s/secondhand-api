import * as bcrypt from 'bcrypt';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from 'crypto';

/**
 * 암호화 유틸리티 클래스
 *
 * 보안 관련 암호화 기능을 제공하는 유틸리티
 * - 비밀번호 해싱 및 검증 (bcrypt)
 * - AES-256-GCM 암호화/복호화
 * - 해시 생성 (SHA-256, MD5)
 * - 랜덤 토큰 생성
 */
export class CryptoUtil {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly SALT_ROUNDS = 10;
  private static readonly IV_LENGTH = 16;
  private static readonly AUTH_TAG_LENGTH = 16;

  /**
   * 비밀번호 해싱 (bcrypt 사용)
   *
   * @param password - 해싱할 평문 비밀번호
   * @param saltRounds - Salt 라운드 수 (기본값: 10)
   * @returns 해싱된 비밀번호
   *
   * @example
   * const hash = await CryptoUtil.hashPassword('myPassword123');
   * // $2b$10$...
   */
  static async hashPassword(
    password: string,
    saltRounds: number = this.SALT_ROUNDS,
  ): Promise<string> {
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * 비밀번호 검증
   *
   * @param password - 검증할 평문 비밀번호
   * @param hash - 저장된 해시값
   * @returns 일치 여부
   *
   * @example
   * const isValid = await CryptoUtil.comparePassword('myPassword123', hash);
   * // true or false
   */
  static async comparePassword(
    password: string,
    hash: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * AES-256-GCM 암호화
   *
   * @param text - 암호화할 평문
   * @param secretKey - 32바이트 비밀 키 (hex 문자열)
   * @returns 암호화된 문자열 (IV:AuthTag:암호문 형식)
   *
   * @example
   * const encrypted = CryptoUtil.encrypt('sensitive data', secretKey);
   * // '1a2b3c4d...5e6f7g8h:9i0j1k2l...3m4n5o6p:encrypted_data'
   */
  static encrypt(text: string, secretKey: string): string {
    try {
      const iv = randomBytes(this.IV_LENGTH);
      const key = Buffer.from(secretKey, 'hex');

      if (key.length !== 32) {
        throw new Error('Secret key must be 32 bytes (64 hex characters)');
      }

      const cipher = createCipheriv(this.ALGORITHM, key, iv);

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();

      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * AES-256-GCM 복호화
   *
   * @param encryptedData - 암호화된 문자열 (IV:AuthTag:암호문 형식)
   * @param secretKey - 32바이트 비밀 키 (hex 문자열)
   * @returns 복호화된 평문
   *
   * @example
   * const decrypted = CryptoUtil.decrypt(encrypted, secretKey);
   * // 'sensitive data'
   */
  static decrypt(encryptedData: string, secretKey: string): string {
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const [ivHex, authTagHex, encrypted] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const key = Buffer.from(secretKey, 'hex');

      if (key.length !== 32) {
        throw new Error('Secret key must be 32 bytes (64 hex characters)');
      }

      const decipher = createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * SHA-256 해시 생성
   *
   * @param text - 해시할 텍스트
   * @returns SHA-256 해시값 (hex 문자열)
   *
   * @example
   * const hash = CryptoUtil.sha256('hello world');
   * // 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
   */
  static sha256(text: string): string {
    return createHash('sha256').update(text).digest('hex');
  }

  /**
   * MD5 해시 생성 (주의: 보안용이 아닌 체크섬 용도로만 사용)
   *
   * @param text - 해시할 텍스트
   * @returns MD5 해시값 (hex 문자열)
   *
   * @example
   * const hash = CryptoUtil.md5('hello world');
   * // '5eb63bbbe01eeed093cb22bb8f5acdc3'
   */
  static md5(text: string): string {
    return createHash('md5').update(text).digest('hex');
  }

  /**
   * 랜덤 토큰 생성 (암호학적으로 안전한 난수)
   *
   * @param length - 토큰 길이 (바이트 수, 기본값: 32)
   * @returns 랜덤 토큰 (hex 문자열)
   *
   * @example
   * const token = CryptoUtil.generateToken(32);
   * // '1a2b3c4d5e6f7g8h...'
   */
  static generateToken(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }

  /**
   * 랜덤 숫자 코드 생성 (OTP, 인증 코드용)
   *
   * @param length - 코드 길이 (숫자 개수, 기본값: 6)
   * @returns 랜덤 숫자 코드
   *
   * @example
   * const code = CryptoUtil.generateNumericCode(6);
   * // '123456'
   */
  static generateNumericCode(length: number = 6): string {
    const digits = '0123456789';
    let code = '';

    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * digits.length);
      code += digits[randomIndex];
    }

    return code;
  }

  /**
   * 32바이트 AES 키 생성
   *
   * @returns 32바이트 키 (hex 문자열, 64자)
   *
   * @example
   * const key = CryptoUtil.generateAESKey();
   * // '1a2b3c4d...' (64 hex characters)
   */
  static generateAESKey(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * HMAC (Hash-based Message Authentication Code) 생성
   *
   * @param message - 메시지
   * @param secret - 비밀 키
   * @returns HMAC 해시값 (hex 문자열)
   *
   * @example
   * const hmac = CryptoUtil.generateHMAC('message', 'secret');
   */
  static generateHMAC(message: string, secret: string): string {
    const hmac = createHash('sha256')
      .update(secret + message)
      .digest('hex');
    return hmac;
  }

  /**
   * Base64 인코딩
   *
   * @param text - 인코딩할 텍스트
   * @returns Base64 인코딩된 문자열
   */
  static base64Encode(text: string): string {
    return Buffer.from(text, 'utf8').toString('base64');
  }

  /**
   * Base64 디코딩
   *
   * @param encoded - Base64 인코딩된 문자열
   * @returns 디코딩된 텍스트
   */
  static base64Decode(encoded: string): string {
    return Buffer.from(encoded, 'base64').toString('utf8');
  }

  /**
   * URL-safe Base64 인코딩
   *
   * @param text - 인코딩할 텍스트
   * @returns URL-safe Base64 문자열
   */
  static base64UrlEncode(text: string): string {
    return Buffer.from(text, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * URL-safe Base64 디코딩
   *
   * @param encoded - URL-safe Base64 문자열
   * @returns 디코딩된 텍스트
   */
  static base64UrlDecode(encoded: string): string {
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return Buffer.from(base64, 'base64').toString('utf8');
  }

  /**
   * 비밀번호 강도 검증
   *
   * @param password - 검증할 비밀번호
   * @returns 강도 점수 (0-4) 및 검증 결과
   *
   * @example
   * const result = CryptoUtil.validatePasswordStrength('MyP@ssw0rd');
   * // { score: 4, isStrong: true, feedback: [...] }
   */
  static validatePasswordStrength(password: string): {
    score: number;
    isStrong: boolean;
    feedback: string[];
  } {
    let score = 0;
    const feedback: string[] = [];

    // 길이 체크
    if (password.length >= 8) score++;
    else feedback.push('비밀번호는 최소 8자 이상이어야 합니다');

    // 대문자 포함
    if (/[A-Z]/.test(password)) score++;
    else feedback.push('대문자를 최소 1개 이상 포함해야 합니다');

    // 소문자 포함
    if (/[a-z]/.test(password)) score++;
    else feedback.push('소문자를 최소 1개 이상 포함해야 합니다');

    // 숫자 포함
    if (/[0-9]/.test(password)) score++;
    else feedback.push('숫자를 최소 1개 이상 포함해야 합니다');

    // 특수문자 포함
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;
    else feedback.push('특수문자를 최소 1개 이상 포함해야 합니다');

    return {
      score: Math.min(score, 4),
      isStrong: score >= 4,
      feedback,
    };
  }
}
