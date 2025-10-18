import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../src/common/auth/guards/roles.guard';
import { Role } from '../src/common/auth/enums/role.enum';
import { ROLES_KEY } from '../src/common/auth/decorators/roles.decorator';
import { JwtValidationResult } from '../src/common/auth/interfaces/jwt-payload.interface';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RolesGuard, Reflector],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  it('정의되어야 함', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    let mockContext: ExecutionContext;
    let mockRequest: any;

    beforeEach(() => {
      mockRequest = {
        user: null,
      };

      mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as any;
    });

    it('@Roles() 데코레이터가 없으면 접근을 허용해야 함', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('빈 역할 배열이면 접근을 허용해야 함', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('사용자 정보가 없으면 ForbiddenException을 발생시켜야 함', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
      mockRequest.user = null;

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext)).toThrow(
        '사용자 인증 정보를 찾을 수 없습니다',
      );
    });

    it('사용자 역할 정보가 없으면 ForbiddenException을 발생시켜야 함', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
      mockRequest.user = {
        userId: 'user-123',
        email: 'test@example.com',
        role: null,
      } as JwtValidationResult;

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext)).toThrow(
        '사용자 역할 정보를 찾을 수 없습니다',
      );
    });

    it('사용자 역할이 요구 역할과 일치하면 접근을 허용해야 함', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
      mockRequest.user = {
        userId: 'user-123',
        email: 'admin@example.com',
        role: Role.ADMIN,
      } as JwtValidationResult;

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('다중 역할 중 하나라도 일치하면 접근을 허용해야 함', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([Role.ADMIN, Role.SELLER]);
      mockRequest.user = {
        userId: 'user-123',
        email: 'seller@example.com',
        role: Role.SELLER,
      } as JwtValidationResult;

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('사용자 역할이 요구 역할과 일치하지 않으면 ForbiddenException을 발생시켜야 함', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
      mockRequest.user = {
        userId: 'user-123',
        email: 'user@example.com',
        role: Role.USER,
      } as JwtValidationResult;

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext)).toThrow(
        '이 작업을 수행할 권한이 없습니다',
      );
    });

    it('ADMIN 역할만 접근 가능한 엔드포인트 테스트', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);

      // USER 역할 - 거부
      mockRequest.user = {
        userId: 'user-123',
        email: 'user@example.com',
        role: Role.USER,
      };
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);

      // ADMIN 역할 - 허용
      mockRequest.user = {
        userId: 'admin-123',
        email: 'admin@example.com',
        role: Role.ADMIN,
      };
      expect(guard.canActivate(mockContext)).toBe(true);
    });

    it('SELLER와 ADMIN만 접근 가능한 엔드포인트 테스트', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([Role.ADMIN, Role.SELLER]);

      // USER 역할 - 거부
      mockRequest.user = {
        userId: 'user-123',
        email: 'user@example.com',
        role: Role.USER,
      };
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);

      // SELLER 역할 - 허용
      mockRequest.user = {
        userId: 'seller-123',
        email: 'seller@example.com',
        role: Role.SELLER,
      };
      expect(guard.canActivate(mockContext)).toBe(true);

      // ADMIN 역할 - 허용
      mockRequest.user = {
        userId: 'admin-123',
        email: 'admin@example.com',
        role: Role.ADMIN,
      };
      expect(guard.canActivate(mockContext)).toBe(true);
    });
  });
});
