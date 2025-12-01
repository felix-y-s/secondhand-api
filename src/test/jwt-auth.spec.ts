import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from '../src/common/auth/strategies/jwt.strategy';
import { JwtRefreshStrategy } from '../src/common/auth/strategies/jwt-refresh.strategy';
import { JwtPayload } from '../src/common/auth/interfaces/jwt-payload.interface';

describe('JWT Authentication', () => {
  let jwtStrategy: JwtStrategy;
  let jwtRefreshStrategy: JwtRefreshStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        JwtRefreshStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'JWT_SECRET') return 'test-secret';
              if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
              return null;
            }),
          },
        },
      ],
    }).compile();

    jwtStrategy = module.get<JwtStrategy>(JwtStrategy);
    jwtRefreshStrategy = module.get<JwtRefreshStrategy>(JwtRefreshStrategy);
  });

  describe('JwtStrategy', () => {
    it('정의되어야 함', () => {
      expect(jwtStrategy).toBeDefined();
    });

    it('유효한 Access Token 페이로드를 검증해야 함', async () => {
      const payload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'user',
        type: 'access',
      };

      const result = await jwtStrategy.validate(payload);

      expect(result).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user',
      });
    });

    it('타입이 없는 페이로드도 검증해야 함', async () => {
      const payload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'user',
      };

      const result = await jwtStrategy.validate(payload);

      expect(result).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user',
      });
    });

    it('Refresh Token 타입은 거부해야 함', async () => {
      const payload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'user',
        type: 'refresh',
      };

      await expect(jwtStrategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(jwtStrategy.validate(payload)).rejects.toThrow(
        '유효하지 않은 토큰 타입입니다',
      );
    });

    it('sub 필드가 누락되면 에러를 발생시켜야 함', async () => {
      const payload = {
        email: 'test@example.com',
        role: 'user',
      } as JwtPayload;

      await expect(jwtStrategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(jwtStrategy.validate(payload)).rejects.toThrow(
        '토큰에 필수 정보가 누락되었습니다',
      );
    });

    it('email 필드가 누락되면 에러를 발생시켜야 함', async () => {
      const payload = {
        sub: 'user-123',
        role: 'user',
      } as JwtPayload;

      await expect(jwtStrategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('role 필드가 누락되면 에러를 발생시켜야 함', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
      } as JwtPayload;

      await expect(jwtStrategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('JwtRefreshStrategy', () => {
    it('정의되어야 함', () => {
      expect(jwtRefreshStrategy).toBeDefined();
    });

    it('유효한 Refresh Token 페이로드를 검증해야 함', async () => {
      const payload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'user',
        type: 'refresh',
      };

      const result = await jwtRefreshStrategy.validate(payload);

      expect(result).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user',
      });
    });

    it('타입이 없는 페이로드도 검증해야 함', async () => {
      const payload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'user',
      };

      const result = await jwtRefreshStrategy.validate(payload);

      expect(result).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user',
      });
    });

    it('Access Token 타입은 거부해야 함', async () => {
      const payload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'user',
        type: 'access',
      };

      await expect(jwtRefreshStrategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(jwtRefreshStrategy.validate(payload)).rejects.toThrow(
        '유효하지 않은 토큰 타입입니다',
      );
    });

    it('필수 필드가 누락되면 에러를 발생시켜야 함', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
      } as JwtPayload;

      await expect(jwtRefreshStrategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(jwtRefreshStrategy.validate(payload)).rejects.toThrow(
        '토큰에 필수 정보가 누락되었습니다',
      );
    });
  });
});
