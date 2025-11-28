# Users 모듈 테스트 전략 가이드

> **작성일**: 2025-11-24
> **대상 모듈**: `src/modules/users`
> **목적**: Users 모듈의 실용적인 테스트 전략 수립

---

## 📋 목차

1. [모듈 분석](#모듈-분석)
2. [테스트 파일 구조 권장사항](#테스트-파일-구조-권장사항)
3. [단위 테스트 (UsersService)](#단위-테스트-usersservice)
4. [통합 테스트 (Service + Repository + DB)](#통합-테스트-service--repository--db)
5. [E2E 테스트 (Controller → Service → Repository → DB)](#e2e-테스트-controller--service--repository--db)
6. [테스트 우선순위](#테스트-우선순위)

---

## 모듈 분석

### 파일 구조

```
src/modules/users/
├── users.controller.ts          # HTTP 엔드포인트
├── users.service.ts              # 비즈니스 로직 ⭐ (단위 테스트 필요)
├── repositories/
│   └── users.repository.ts       # DB 접근 계층
├── dto/
│   ├── create-user.dto.ts
│   ├── update-user.dto.ts
│   ├── login-user.dto.ts
│   ├── user-response.dto.ts
│   └── auth-response.dto.ts
└── users.module.ts
```

### 비즈니스 로직 분석

#### ✅ **UsersService - 단위 테스트 필요**
⭐️ 단위 테스트는 "결과값"이 아니라 "비즈니스 로직의 실행 과정"을 검증합니다:

**Service는 풍부한 비즈니스 로직을 포함**하고 있습니다:

1. **회원가입 (`create`)**
   - ✅ 이메일 중복 체크 로직
   - ✅ 닉네임 중복 체크 로직
   - ✅ 전화번호 중복 체크 로직 (선택)
   - ✅ 비밀번호 해싱 로직 (bcrypt)
   - ✅ 예외 처리: `ConflictException`

2. **로그인 (`login`)**
   - ✅ 이메일로 사용자 조회
   - ✅ 계정 활성 상태 검증
   - ✅ 비밀번호 검증 (bcrypt.compare)
   - ✅ 마지막 로그인 시간 업데이트
   - ✅ JWT 토큰 생성 (Access + Refresh)
   - ✅ 예외 처리: `UnauthorizedException`

3. **사용자 조회 (`findOne`)**
   - ✅ 사용자 존재 여부 검증
   - ✅ 비밀번호 제외 로직
   - ✅ 예외 처리: `NotFoundException`

4. **정보 수정 (`update`)**
   - ✅ 사용자 존재 여부 검증
   - ✅ 닉네임 중복 체크 (변경 시)
   - ✅ 전화번호 중복 체크 (변경 시)
   - ✅ 예외 처리: `NotFoundException`, `ConflictException`

5. **회원 탈퇴 (`remove`)**
   - ✅ 사용자 존재 여부 검증
   - ✅ 이미 탈퇴한 계정 체크
   - ✅ 진행 중인 주문 확인
   - ✅ 소프트 삭제 호출
   - ✅ 예외 처리: `NotFoundException`, `BadRequestException`, `ConflictException`

6. **토큰 재발급 (`refreshAccessToken`)**
   - ✅ 사용자 존재 여부 검증
   - ✅ 계정 활성 상태 검증
   - ✅ 새로운 토큰 생성
   - ✅ 예외 처리: `NotFoundException`, `UnauthorizedException`

#### ❌ **UsersRepository - 단위 테스트 불필요**

Repository는 단순히 Prisma 메서드만 호출합니다:
- ❌ 비즈니스 로직 없음
- ✅ 통합 테스트로 검증 (실제 DB 사용)

---

## 테스트 파일 구조 권장사항

### ✅ **필요한 테스트 파일**

```
src/modules/users/
├── users.service.spec.ts              ⭐ 생성 필요 (단위 테스트)
├── users.integration.spec.ts          ⭐ 생성 필요 (통합 테스트)
└── users.e2e.spec.ts                   ⭐ 생성 필요 (E2E 테스트)
```

### ❌ **생성하지 말아야 할 테스트 파일**

```
❌ users.repository.spec.ts            (비즈니스 로직 없음)
❌ users.controller.spec.ts            (E2E로 충분)
❌ dto/*.spec.ts                        (DTO는 테스트 불필요)
```

---

## 단위 테스트 (UsersService)

### 📝 목적
**Service의 비즈니스 로직만 검증 (Repository는 모킹)**

### 파일: `users.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UsersRepository } from './repositories/users.repository';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OrdersService } from '../orders/orders.service';
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

// bcrypt 모킹
jest.mock('bcrypt');

describe('UsersService 단위 테스트', () => {
  let service: UsersService;
  let repository: UsersRepository;
  let jwtService: JwtService;
  let configService: ConfigService;
  let ordersService: OrdersService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    password: 'hashedPassword',
    nickname: '테스터',
    name: '홍길동',
    phoneNumber: '01012345678',
    role: 'USER',
    isActive: true,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UsersRepository,
          useValue: {
            findByEmail: jest.fn(),
            findByNickname: jest.fn(),
            findByPhoneNumber: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
            updateLastLogin: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: OrdersService,
          useValue: {
            hasOngoingOrdersByUserId: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get<UsersRepository>(UsersRepository);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
    ordersService = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create (회원가입)', () => {
    const createUserDto = {
      email: 'newuser@example.com',
      password: 'Password123!',
      nickname: '신규유저',
      name: '김철수',
      phoneNumber: '01087654321',
    };

    it('정상적으로 회원가입할 수 있다', async () => {
      // Given: 중복 없음
      jest.spyOn(repository, 'findByEmail').mockResolvedValue(null);
      jest.spyOn(repository, 'findByNickname').mockResolvedValue(null);
      jest.spyOn(repository, 'findByPhoneNumber').mockResolvedValue(null);
      jest.spyOn(repository, 'create').mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');

      // When: 회원가입
      const result = await service.create(createUserDto);

      // Then: 중복 체크 호출 검증
      expect(repository.findByEmail).toHaveBeenCalledWith(createUserDto.email);
      expect(repository.findByNickname).toHaveBeenCalledWith(
        createUserDto.nickname,
      );
      expect(repository.findByPhoneNumber).toHaveBeenCalledWith(
        createUserDto.phoneNumber,
      );

      // Then: 비밀번호 해싱 검증
      expect(bcrypt.hash).toHaveBeenCalledWith(createUserDto.password, 10);

      // Then: 사용자 생성 호출 검증
      expect(repository.create).toHaveBeenCalledWith({
        email: createUserDto.email,
        password: 'hashedPassword',
        nickname: createUserDto.nickname,
        name: createUserDto.name,
        phoneNumber: createUserDto.phoneNumber,
      });

      // Then: 비밀번호가 제외된 결과 반환
      expect(result).not.toHaveProperty('password');
      expect(result.email).toBe(mockUser.email);
    });

    it('이메일 중복 시 ConflictException 발생', async () => {
      // Given: 이메일 중복
      jest.spyOn(repository, 'findByEmail').mockResolvedValue(mockUser);

      // When & Then: 예외 발생
      await expect(service.create(createUserDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(createUserDto)).rejects.toThrow(
        '이미 사용 중인 이메일입니다',
      );

      // Then: 중복 체크 이후 로직은 실행되지 않음
      expect(repository.findByNickname).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('닉네임 중복 시 ConflictException 발생', async () => {
      // Given: 닉네임 중복
      jest.spyOn(repository, 'findByEmail').mockResolvedValue(null);
      jest.spyOn(repository, 'findByNickname').mockResolvedValue(mockUser);

      // When & Then: 예외 발생
      await expect(service.create(createUserDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(createUserDto)).rejects.toThrow(
        '이미 사용 중인 닉네임입니다',
      );

      // Then: 예외 발생 전까지 호출된 함수 검증
      expect(repository.findByEmail).toHaveBeenCalledWith(createUserDto.email);
      expect(repository.findByNickname).toHaveBeenCalledWith(createUserDto.nickname);

      // Then: 예외 발생 후 더 이상 진행하지 않았는지 검증
      expect(repository.findByPhoneNumber).not.toHaveBeenCalled();
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('전화번호 중복 시 ConflictException 발생', async () => {
      // Given: 전화번호 중복
      jest.spyOn(repository, 'findByEmail').mockResolvedValue(null);
      jest.spyOn(repository, 'findByNickname').mockResolvedValue(null);
      jest.spyOn(repository, 'findByPhoneNumber').mockResolvedValue(mockUser);

      // When & Then: 예외 발생
      await expect(service.create(createUserDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(createUserDto)).rejects.toThrow(
        '이미 사용 중인 전화번호입니다',
      );

      // Then: 예외 발생 전까지 호출된 함수 검증
      expect(repository.findByEmail).toHaveBeenCalledWith(createUserDto.email);
      expect(repository.findByNickname).toHaveBeenCalledWith(createUserDto.nickname);
      expect(repository.findByPhoneNumber).toHaveBeenCalledWith(createUserDto.phoneNumber);

      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('login (로그인)', () => {
    const loginUserDto = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    it('정상적으로 로그인할 수 있다', async () => {
      // Given: 사용자 존재, 비밀번호 일치
      jest.spyOn(repository, 'findByEmail').mockResolvedValue(mockUser);
      jest.spyOn(repository, 'updateLastLogin').mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jest.spyOn(jwtService, 'signAsync').mockResolvedValue('mock-token');
      jest.spyOn(configService, 'get').mockReturnValue('secret');

      // When: 로그인
      const result = await service.login(loginUserDto);

      // Then: 이메일로 사용자 조회 검증
      expect(repository.findByEmail).toHaveBeenCalledWith(loginUserDto.email);

      // Then: 비밀번호 검증
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginUserDto.password,
        mockUser.password,
      );

      // Then: 마지막 로그인 시간 업데이트
      expect(repository.updateLastLogin).toHaveBeenCalledWith(mockUser.id);

      // Then: JWT 토큰 생성 검증
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2); // Access + Refresh

      // Then: 결과에 토큰과 사용자 정보 포함
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user).not.toHaveProperty('password');
    });

    it('존재하지 않는 이메일로 로그인 시 UnauthorizedException 발생', async () => {
      // Given: 사용자 존재하지 않음
      jest.spyOn(repository, 'findByEmail').mockResolvedValue(null);

      // When & Then: 예외 발생
      await expect(service.login(loginUserDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginUserDto)).rejects.toThrow(
        '이메일 또는 비밀번호가 일치하지 않습니다',
      );

      // Then: 비밀번호 검증은 호출되지 않음
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('비활성화된 계정으로 로그인 시 UnauthorizedException 발생', async () => {
      // Given: 비활성화된 사용자
      const inactiveUser = { ...mockUser, isActive: false };
      jest.spyOn(repository, 'findByEmail').mockResolvedValue(inactiveUser);

      // When & Then: 예외 발생
      await expect(service.login(loginUserDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginUserDto)).rejects.toThrow(
        '비활성화된 계정입니다',
      );
    });

    it('비밀번호 불일치 시 UnauthorizedException 발생', async () => {
      // Given: 비밀번호 불일치
      jest.spyOn(repository, 'findByEmail').mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // When & Then: 예외 발생
      await expect(service.login(loginUserDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginUserDto)).rejects.toThrow(
        '이메일 또는 비밀번호가 일치하지 않습니다',
      );

      // Then: 마지막 로그인 시간 업데이트는 호출되지 않음
      expect(repository.updateLastLogin).not.toHaveBeenCalled();
    });
  });

  describe('findOne (사용자 조회)', () => {
    it('정상적으로 사용자를 조회할 수 있다', async () => {
      // Given: 사용자 존재
      jest.spyOn(repository, 'findById').mockResolvedValue(mockUser);

      // When: 조회
      const result = await service.findOne(mockUser.id);

      // Then: Repository 호출 검증
      expect(repository.findById).toHaveBeenCalledWith(mockUser.id);

      // Then: 비밀번호 제외 확인
      expect(result).not.toHaveProperty('password');
      expect(result.email).toBe(mockUser.email);
    });

    it('존재하지 않는 사용자 조회 시 NotFoundException 발생', async () => {
      // Given: 사용자 존재하지 않음
      jest.spyOn(repository, 'findById').mockResolvedValue(null);

      // When & Then: 예외 발생
      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('invalid-id')).rejects.toThrow(
        '사용자를 찾을 수 없습니다',
      );
    });
  });

  describe('update (정보 수정)', () => {
    const updateUserDto = {
      nickname: '새닉네임',
      phoneNumber: '01099998888',
    };

    it('정상적으로 사용자 정보를 수정할 수 있다', async () => {
      // Given: 사용자 존재, 중복 없음
      jest.spyOn(repository, 'findById').mockResolvedValue(mockUser);
      jest.spyOn(repository, 'findByNickname').mockResolvedValue(null);
      jest.spyOn(repository, 'findByPhoneNumber').mockResolvedValue(null);
      const updatedUser = { ...mockUser, ...updateUserDto };
      jest.spyOn(repository, 'update').mockResolvedValue(updatedUser);

      // When: 수정
      const result = await service.update(mockUser.id, updateUserDto);

      // Then: 사용자 존재 확인
      expect(repository.findById).toHaveBeenCalledWith(mockUser.id);

      // Then: 중복 체크
      expect(repository.findByNickname).toHaveBeenCalledWith(
        updateUserDto.nickname,
      );
      expect(repository.findByPhoneNumber).toHaveBeenCalledWith(
        updateUserDto.phoneNumber,
      );

      // Then: 수정 호출
      expect(repository.update).toHaveBeenCalledWith(mockUser.id, updateUserDto);

      // Then: 비밀번호 제외 확인
      expect(result).not.toHaveProperty('password');
      expect(result.nickname).toBe(updateUserDto.nickname);
    });

    it('존재하지 않는 사용자 수정 시 NotFoundException 발생', async () => {
      // Given: 사용자 존재하지 않음
      jest.spyOn(repository, 'findById').mockResolvedValue(null);

      // When & Then: 예외 발생
      await expect(service.update('invalid-id', updateUserDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('닉네임 중복 시 ConflictException 발생', async () => {
      // Given: 닉네임 중복
      jest.spyOn(repository, 'findById').mockResolvedValue(mockUser);
      const otherUser = { ...mockUser, id: 'other-user' };
      jest.spyOn(repository, 'findByNickname').mockResolvedValue(otherUser);

      // When & Then: 예외 발생
      await expect(
        service.update(mockUser.id, updateUserDto),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove (회원 탈퇴)', () => {
    it('정상적으로 회원 탈퇴할 수 있다', async () => {
      // Given: 사용자 존재, 진행 중인 주문 없음
      jest.spyOn(repository, 'findById').mockResolvedValue(mockUser);
      jest
        .spyOn(ordersService, 'hasOngoingOrdersByUserId')
        .mockResolvedValue(false);
      const deletedUser = { ...mockUser, isActive: false };
      jest.spyOn(repository, 'softDelete').mockResolvedValue(deletedUser);

      // When: 회원 탈퇴
      const result = await service.remove(mockUser.id);

      // Then: 사용자 존재 확인
      expect(repository.findById).toHaveBeenCalledWith(mockUser.id);

      // Then: 진행 중인 주문 확인
      expect(ordersService.hasOngoingOrdersByUserId).toHaveBeenCalledWith(
        mockUser.id,
      );

      // Then: 소프트 삭제 호출
      expect(repository.softDelete).toHaveBeenCalledWith(mockUser.id);

      // Then: 비활성화된 사용자 반환
      expect(result.isActive).toBe(false);
    });

    it('이미 탈퇴한 계정으로 재탈퇴 시 BadRequestException 발생', async () => {
      // Given: 이미 비활성화된 사용자
      const inactiveUser = { ...mockUser, isActive: false };
      jest.spyOn(repository, 'findById').mockResolvedValue(inactiveUser);

      // When & Then: 예외 발생
      await expect(service.remove(mockUser.id)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.remove(mockUser.id)).rejects.toThrow(
        '이미 탈퇴한 계정입니다',
      );
    });

    it('진행 중인 주문이 있을 시 ConflictException 발생', async () => {
      // Given: 진행 중인 주문 존재
      jest.spyOn(repository, 'findById').mockResolvedValue(mockUser);
      jest
        .spyOn(ordersService, 'hasOngoingOrdersByUserId')
        .mockResolvedValue(true);

      // When & Then: 예외 발생
      await expect(service.remove(mockUser.id)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.remove(mockUser.id)).rejects.toThrow(
        '진행 중인 거래가 있어 탈퇴할 수 없습니다',
      );

      // Then: 소프트 삭제는 호출되지 않음
      expect(repository.softDelete).not.toHaveBeenCalled();
    });
  });

  describe('refreshAccessToken (토큰 재발급)', () => {
    it('정상적으로 새로운 토큰을 발급받을 수 있다', async () => {
      // Given: 사용자 존재, 활성 상태
      jest.spyOn(repository, 'findById').mockResolvedValue(mockUser);
      jest.spyOn(jwtService, 'signAsync').mockResolvedValue('new-token');
      jest.spyOn(configService, 'get').mockReturnValue('secret');

      // When: 토큰 재발급
      const result = await service.refreshAccessToken(mockUser.id);

      // Then: 사용자 조회
      expect(repository.findById).toHaveBeenCalledWith(mockUser.id);

      // Then: 새로운 토큰 생성
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);

      // Then: 토큰 반환
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('비활성화된 계정으로 토큰 재발급 시 UnauthorizedException 발생', async () => {
      // Given: 비활성화된 사용자
      const inactiveUser = { ...mockUser, isActive: false };
      jest.spyOn(repository, 'findById').mockResolvedValue(inactiveUser);

      // When & Then: 예외 발생
      await expect(service.refreshAccessToken(mockUser.id)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshAccessToken(mockUser.id)).rejects.toThrow(
        '비활성화된 계정입니다',
      );
    });
  });
});
```

---

## 통합 테스트 (Service + Repository + DB)

### 📝 목적
**Service와 Repository가 실제 DB와 함께 정상 작동하는지 검증**

### 파일: `users.integration.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UsersRepository } from './repositories/users.repository';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OrdersService } from '../orders/orders.service';
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

describe('Users 모듈 통합 테스트', () => {
  let service: UsersService;
  let repository: UsersRepository;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        UsersRepository,
        PrismaService,
        JwtService,
        ConfigService,
        {
          provide: OrdersService,
          useValue: {
            hasOngoingOrdersByUserId: jest.fn().mockResolvedValue(false),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get<UsersRepository>(UsersRepository);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(async () => {
    // 테스트 데이터 정리
    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: 'integration-test-',
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('회원가입 → 로그인 → 조회 → 수정 → 탈퇴 전체 시나리오', () => {
    it('사용자 라이프사이클 전체 흐름이 정상 작동한다', async () => {
      const timestamp = Date.now();
      const createUserDto = {
        email: `integration-test-${timestamp}@example.com`,
        password: 'Password123!',
        nickname: `통합테스트-${timestamp}`,
        name: '테스터',
        phoneNumber: `010${timestamp.toString().slice(-8)}`,
      };

      // 1. 회원가입
      const createdUser = await service.create(createUserDto);
      expect(createdUser.email).toBe(createUserDto.email);
      expect(createdUser).not.toHaveProperty('password');

      // 2. DB에서 직접 확인
      const userInDb = await prisma.user.findUnique({
        where: { email: createUserDto.email },
      });
      expect(userInDb).not.toBeNull();
      expect(userInDb.nickname).toBe(createUserDto.nickname);

      // 3. 로그인
      const loginResult = await service.login({
        email: createUserDto.email,
        password: createUserDto.password,
      });
      expect(loginResult).toHaveProperty('accessToken');
      expect(loginResult).toHaveProperty('refreshToken');
      expect(loginResult.user.email).toBe(createUserDto.email);

      // 4. 사용자 조회
      const foundUser = await service.findOne(createdUser.id);
      expect(foundUser.email).toBe(createUserDto.email);
      expect(foundUser).not.toHaveProperty('password');

      // 5. 정보 수정
      const updateDto = {
        nickname: `수정된닉네임-${timestamp}`,
        phoneNumber: `010${(timestamp + 1).toString().slice(-8)}`,
      };
      const updatedUser = await service.update(createdUser.id, updateDto);
      expect(updatedUser.nickname).toBe(updateDto.nickname);
      expect(updatedUser.phoneNumber).toBe(updateDto.phoneNumber);

      // 6. DB에서 수정 확인
      const updatedInDb = await prisma.user.findUnique({
        where: { id: createdUser.id },
      });
      expect(updatedInDb.nickname).toBe(updateDto.nickname);

      // 7. 회원 탈퇴
      const deletedUser = await service.remove(createdUser.id);
      expect(deletedUser.isActive).toBe(false);

      // 8. DB에서 소프트 삭제 확인
      const deletedInDb = await prisma.user.findUnique({
        where: { id: createdUser.id },
      });
      expect(deletedInDb.isActive).toBe(false);

      // 9. 탈퇴한 계정으로 로그인 시도 - 실패
      await expect(
        service.login({
          email: createUserDto.email,
          password: createUserDto.password,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('중복 체크 통합 테스트', () => {
    const timestamp = Date.now();
    const baseUser = {
      email: `duplicate-test-${timestamp}@example.com`,
      password: 'Password123!',
      nickname: `중복테스트-${timestamp}`,
      phoneNumber: `010${timestamp.toString().slice(-8)}`,
    };

    beforeEach(async () => {
      // 기존 사용자 생성
      await service.create(baseUser);
    });

    it('이메일 중복 시 회원가입 실패', async () => {
      await expect(
        service.create({
          ...baseUser,
          email: baseUser.email, // 중복
          nickname: `다른닉네임-${timestamp}`,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('닉네임 중복 시 회원가입 실패', async () => {
      await expect(
        service.create({
          ...baseUser,
          email: `다른이메일-${timestamp}@example.com`,
          nickname: baseUser.nickname, // 중복
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('전화번호 중복 시 회원가입 실패', async () => {
      await expect(
        service.create({
          ...baseUser,
          email: `다른이메일-${timestamp}@example.com`,
          nickname: `다른닉네임-${timestamp}`,
          phoneNumber: baseUser.phoneNumber, // 중복
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
```

### 🔍 위 통합 테스트 코드의 개선 필요 항목

> **참고**: 위 예제는 통합 테스트의 기본 구조를 설명하기 위한 것입니다. 실제 프로젝트의 `users.integration.spec.ts`는 아래 개선 사항들이 모두 반영되어 있습니다.

#### 1. 테스트 격리 전략 개선 필요

**현재 문제점**:
- 하나의 테스트가 9개의 단계를 수행 (회원가입 → 로그인 → 조회 → 수정 → 탈퇴 → 검증)
- 중간 단계에서 실패하면 원인 파악이 어려움
- 테스트 가독성과 유지보수성 저하

**개선 방향**:
```typescript
describe('회원가입', () => {
  it('유효한 정보로 회원가입이 성공한다', async () => { /* ... */ });
  it('중복 이메일로 회원가입 시 ConflictException 발생', async () => { /* ... */ });
});

describe('로그인', () => {
  beforeAll(async () => {
    // 테스트용 사용자 미리 생성
  });

  it('올바른 인증 정보로 로그인이 성공한다', async () => { /* ... */ });
  it('비활성화된 계정으로 로그인 시 UnauthorizedException 발생', async () => { /* ... */ });
});

describe('회원 탈퇴', () => {
  describe('실패 케이스', () => {
    it('진행 중인 주문(PAID)이 있으면 탈퇴 불가', async () => { /* ... */ });
  });

  describe('성공 케이스 - PENDING 주문 자동 취소', () => {
    it('판매자 탈퇴 시 PENDING 주문은 CANCELLED로 변경', async () => { /* ... */ });
  });
});
```

**장점**:
- 각 테스트가 하나의 시나리오만 검증 (단일 책임 원칙)
- 실패 시 정확히 어떤 기능에서 문제가 발생했는지 즉시 파악 가능
- 특정 기능만 선택적으로 테스트 실행 가능

#### 2. 테스트 데이터 관리 개선 필요

**현재 문제점**:
- 패턴 기반 정리: `startsWith: 'integration-test-'`
- 외래 키 제약이 있는 연관 데이터 정리 순서 문제 발생 가능
- 다른 테스트에서 생성한 데이터를 실수로 삭제할 위험

**개선 방향**:
```typescript
describe('회원 탈퇴', () => {
  // 공유 데이터 (모든 하위 테스트에서 필요)
  let testCategoryId: string;
  let testBuyerId: string;

  beforeAll(async () => {
    // 카테고리와 구매자는 여러 테스트에서 재사용
    testCategoryId = (await prisma.category.create({ /* ... */ })).id;
    testBuyerId = (await prisma.user.create({ /* ... */ })).id;
  });

  describe('실패 케이스', () => {
    // 이 describe 블록에서만 필요한 데이터
    let testSellerId: string;
    let testProductId: string;
    let testOrderId: string;

    beforeAll(async () => {
      testSellerId = (await prisma.user.create({ /* ... */ })).id;
      testProductId = (await prisma.product.create({ /* ... */ })).id;
      testOrderId = (await prisma.order.create({ /* ... */ })).id;
    });

    afterAll(async () => {
      // 외래 키 순서에 맞게 정확한 ID로 정리
      await prisma.order.delete({ where: { id: testOrderId } });
      await prisma.product.delete({ where: { id: testProductId } });
      await prisma.user.delete({ where: { id: testSellerId } });
    });
  });

  afterAll(async () => {
    // 공유 데이터 정리
    await prisma.user.delete({ where: { id: testBuyerId } });
    await prisma.category.delete({ where: { id: testCategoryId } });
  });
});
```

**장점**:
- ID 기반 정리로 외래 키 제약 순서 문제 해결
- 정확히 생성한 데이터만 정리 (다른 테스트 데이터 보호)
- 데이터 생명주기 명확화 (어디서 생성되고 어디서 정리되는지)

#### 3. 실제 의존성 사용 필요

**현재 문제점**:
- `OrdersService`를 Mock으로 처리
- 통합 테스트 목적과 맞지 않음 (실제 서비스 간 통합 검증 못함)

**개선 방향**:
```typescript
beforeEach(async () => {
  const module: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      // 실제 모듈 import (Mock 없음)
    ],
    providers: [
      UsersService,
      UsersRepository,
      OrdersService,  // 실제 OrdersService 사용
      PrismaService,
      JwtService,
    ],
  }).compile();

  usersService = module.get<UsersService>(UsersService);
  prisma = module.get<PrismaService>(PrismaService);
  // ordersService Mock 설정 제거
});
```

**장점**:
- 실제 서비스 간 상호작용 검증
- `UsersService.remove()` 호출 시 실제 `OrdersService.hasOngoingOrdersByUserId()` 동작 확인
- 통합 테스트 본래 목적에 부합

#### 4. 복잡한 비즈니스 로직 시나리오 검증 필요

**현재 문제점**:
- 단순 CRUD 흐름만 검증
- 트랜잭션, 다중 테이블 변경, 외래 키 제약 등 복잡한 시나리오 미검증

**개선 방향**:
```typescript
describe('회원 탈퇴 - 복잡한 트랜잭션 시나리오', () => {
  it('판매자 탈퇴 시 연관 데이터가 올바르게 처리된다', async () => {
    // Given: 판매자, 상품, 주문 생성
    const seller = await prisma.user.create({ /* ... */ });
    const product = await prisma.product.create({
      data: {
        sellerId: seller.id,
        status: 'ACTIVE',  // 판매 중
        /* ... */
      },
    });
    const order = await prisma.order.create({
      data: {
        sellerId: seller.id,
        status: 'PENDING',  // 진행 중
        /* ... */
      },
    });

    // When: 탈퇴 실행
    await usersService.remove(seller.id);

    // Then: 트랜잭션으로 다음을 모두 검증
    // 1. 사용자 비활성화
    const deletedUser = await prisma.user.findUnique({
      where: { id: seller.id },
    });
    expect(deletedUser?.isActive).toBe(false);

    // 2. PENDING 주문 자동 취소
    const cancelledOrder = await prisma.order.findUnique({
      where: { id: order.id },
    });
    expect(cancelledOrder?.status).toBe('CANCELLED');

    // 3. ACTIVE 상품 삭제 처리
    const deletedProduct = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(deletedProduct?.status).toBe('DELETED');
  });
});
```

**장점**:
- 실제 비즈니스 로직의 복잡성 반영
- 트랜잭션 성공/실패 시나리오 검증
- 다중 테이블 변경의 원자성 확인
- 외래 키 제약 처리 검증

#### 실제 구현 파일 참고

위 개선 사항들이 모두 반영된 실제 코드는 다음 파일을 참고하세요:
- `src/modules/users/users.integration.spec.ts`

---

## E2E 테스트 (Controller → Service → Repository → DB)

### 📝 목적
**실제 HTTP 요청부터 DB 저장까지 전체 흐름 검증**

### 파일: `users.e2e.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import request from 'supertest';

describe('Users API E2E 테스트', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let testUserToken: string;
  let testUserId: string;

  const timestamp = Date.now();

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();

    app.useGlobalPipes();
    app.useGlobalGuards();
    app.useGlobalInterceptors(new TransformInterceptor());
    app.setGlobalPrefix('api/v1');

    await app.init();

    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    try {
      // 테스트 사용자 정리
      if (testUserId) {
        await prisma.user.delete({ where: { id: testUserId } });
      }
      await app.close();
    } catch (error) {
      console.error('❌ 테스트 리소스 정리 중 에러:', error.message);
    }
  });

  describe('POST /users/register (회원가입)', () => {
    it('정상적으로 회원가입할 수 있다', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send({
          email: `e2e-test-${timestamp}@example.com`,
          password: 'Password123!',
          nickname: `E2E테스터-${timestamp}`,
          name: '홍길동',
          phoneNumber: `010${timestamp.toString().slice(-8)}`,
        })
        .expect(201);

      const body = response.body;

      // 응답 구조 검증
      expect(body.success).toBeTruthy();
      expect(body.data).toHaveProperty('accessToken');
      expect(body.data).toHaveProperty('refreshToken');
      expect(body.data.user).toHaveProperty('email');
      expect(body.data.user).not.toHaveProperty('password');

      // 자동 로그인 토큰 저장
      testUserToken = body.data.accessToken;

      // JWT 페이로드에서 userId 추출
      const payload = JSON.parse(
        Buffer.from(testUserToken.split('.')[1], 'base64').toString(),
      );
      testUserId = payload.sub;

      // DB 확인
      const userInDb = await prisma.user.findUnique({
        where: { id: testUserId },
      });
      expect(userInDb).not.toBeNull();
      expect(userInDb.email).toBe(`e2e-test-${timestamp}@example.com`);
    });

    it('이메일 중복 시 409 에러 발생', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send({
          email: `e2e-test-${timestamp}@example.com`, // 중복
          password: 'Password123!',
          nickname: `다른닉네임-${timestamp}`,
        })
        .expect(409);
    });

    it('잘못된 이메일 형식 시 400 에러 발생', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send({
          email: 'invalid-email', // 잘못된 형식
          password: 'Password123!',
          nickname: `테스터-${timestamp}`,
        })
        .expect(400);
    });
  });

  describe('POST /users/login (로그인)', () => {
    it('정상적으로 로그인할 수 있다', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/users/login')
        .send({
          email: `e2e-test-${timestamp}@example.com`,
          password: 'Password123!',
        })
        .expect(200);

      const body = response.body;

      expect(body.success).toBeTruthy();
      expect(body.data).toHaveProperty('accessToken');
      expect(body.data).toHaveProperty('refreshToken');
      expect(body.data.user.email).toBe(`e2e-test-${timestamp}@example.com`);
    });

    it('잘못된 비밀번호로 로그인 시 401 에러 발생', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/users/login')
        .send({
          email: `e2e-test-${timestamp}@example.com`,
          password: 'WrongPassword!',
        })
        .expect(401);
    });
  });

  describe('GET /users/me (내 정보 조회)', () => {
    it('인증된 사용자는 내 정보를 조회할 수 있다', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      const body = response.body;

      expect(body.success).toBeTruthy();
      expect(body.data.email).toBe(`e2e-test-${timestamp}@example.com`);
      expect(body.data).not.toHaveProperty('password');
    });

    it('인증 없이 조회 시 401 에러 발생', async () => {
      await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
    });
  });

  describe('PATCH /users/me (내 정보 수정)', () => {
    it('인증된 사용자는 내 정보를 수정할 수 있다', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          nickname: `수정된닉네임-${timestamp}`,
          name: '김철수',
        })
        .expect(200);

      const body = response.body;

      expect(body.success).toBeTruthy();
      expect(body.data.nickname).toBe(`수정된닉네임-${timestamp}`);
      expect(body.data.name).toBe('김철수');

      // DB 확인
      const userInDb = await prisma.user.findUnique({
        where: { id: testUserId },
      });
      expect(userInDb.nickname).toBe(`수정된닉네임-${timestamp}`);
    });
  });

  describe('DELETE /users/me (회원 탈퇴)', () => {
    it('인증된 사용자는 회원 탈퇴할 수 있다', async () => {
      const response = await request(app.getHttpServer())
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      const body = response.body;

      expect(body.success).toBeTruthy();
      expect(body.message).toBe('회원 탈퇴가 완료되었습니다');

      // DB에서 소프트 삭제 확인
      const userInDb = await prisma.user.findUnique({
        where: { id: testUserId },
      });
      expect(userInDb.isActive).toBe(false);

      // 탈퇴한 계정으로 로그인 시도 - 실패
      await request(app.getHttpServer())
        .post('/api/v1/users/login')
        .send({
          email: `e2e-test-${timestamp}@example.com`,
          password: 'Password123!',
        })
        .expect(401);
    });
  });
});
```

---

## 테스트 우선순위

### 1️⃣ **단위 테스트 (UsersService)** - 최우선

**이유**:
- ✅ Service에 비즈니스 로직이 풍부함
- ✅ 빠른 피드백 (밀리초 단위)
- ✅ 복잡한 조건 분기 테스트 용이
- ✅ 예외 처리 검증 쉬움

**커버해야 할 로직**:
- 회원가입 (이메일/닉네임/전화번호 중복 체크, 비밀번호 해싱)
- 로그인 (비밀번호 검증, 계정 상태 체크, JWT 생성)
- 정보 수정 (중복 체크, 권한 확인)
- 회원 탈퇴 (진행 중인 주문 확인, 소프트 삭제)
- 토큰 재발급 (계정 상태 검증)

### 2️⃣ **E2E 테스트** - 중요

**이유**:
- ✅ 실제 사용자 시나리오 검증
- ✅ HTTP 요청/응답 구조 검증
- ✅ 인증/인가 흐름 검증
- ✅ 전체 통합 확인

**커버해야 할 시나리오**:
- 회원가입 → 자동 로그인
- 로그인 → 내 정보 조회
- 정보 수정 → DB 확인
- 회원 탈퇴 → 로그인 불가

### 3️⃣ **통합 테스트 (Service + Repository + DB)** - 선택

**이유**:
- ⚠️ E2E와 단위 테스트로 대부분 커버 가능
- ⚠️ 단위 테스트가 충분하다면 생략 가능
- ✅ 복잡한 DB 트랜잭션 검증 시 유용 (소프트 삭제 등)

---

## 📊 테스트 커버리지 목표

```yaml
단위 테스트 (UsersService):
  - 목표: 80% 이상
  - 중점: 비즈니스 로직, 예외 처리, 조건 분기

E2E 테스트:
  - 목표: 핵심 시나리오 100% 커버
  - 중점: 회원가입, 로그인, CRUD, 인증/인가

통합 테스트:
  - 목표: 선택적 (복잡한 트랜잭션만)
  - 중점: 소프트 삭제, 다중 테이블 트랜잭션
```

---

## ✅ 체크리스트

### 필수 작업
- [ ] `users.service.spec.ts` 생성 (단위 테스트)
- [ ] `users.e2e.spec.ts` 생성 (E2E 테스트)
- [ ] 회원가입 비즈니스 로직 단위 테스트 작성
- [ ] 로그인 비즈니스 로직 단위 테스트 작성
- [ ] 회원 탈퇴 비즈니스 로직 단위 테스트 작성
- [ ] 핵심 E2E 시나리오 작성

### 선택 작업
- [ ] `users.integration.spec.ts` 생성 (통합 테스트)
- [ ] 소프트 삭제 트랜잭션 통합 테스트 작성

---

## 🎯 결론

**Users 모듈 테스트 전략 요약**:

1. **단위 테스트 필수** ⭐⭐⭐
   - Service에 비즈니스 로직이 풍부함
   - 중복 체크, 비밀번호 검증, 예외 처리 등
   - 빠른 피드백, 높은 커버리지

2. **E2E 테스트 필수** ⭐⭐⭐
   - 실제 사용자 시나리오 검증
   - 인증/인가 흐름 확인
   - HTTP 요청/응답 검증

3. **통합 테스트 선택** ⭐
   - 복잡한 트랜잭션만 선택적으로
   - 소프트 삭제, 다중 테이블 조작

**총 테스트 파일 개수**: 2~3개
- `users.service.spec.ts` (필수)
- `users.e2e.spec.ts` (필수)
- `users.integration.spec.ts` (선택)

---

> **작성일**: 2025-11-24
> **버전**: 1.0
> **작성자**: Claude AI Assistant
