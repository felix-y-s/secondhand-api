import { Role } from '@prisma/client';
import { UsersRepository } from './repositories/users.repository';
import { UsersService } from './users.service';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateUserDto, UpdateUserDto } from './dto';
import { ConfigService } from '@nestjs/config';
import { OrdersService } from '../orders/orders.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

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
    profileImage: null,
    bio: null,
    role: Role.USER,
    emailVerified: false,
    phoneVerified: false,
    rating: 0,
    ratingCount: 0,
    trustScore: 0,
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
            updateLastLogin: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
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
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
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
    const createUserDto: CreateUserDto = {
      email: 'newuser@example.com',
      password: 'Password123!',
      nickname: '신규유저',
      name: '김철수',
      phoneNumber: '01087654321',
    };

    it('정상적으로 회원가입할 수 있다', async () => {
      // Given: 사용자 존재, 비밀번호 일치
      jest.spyOn(repository, 'findByEmail').mockResolvedValue(null);
      jest.spyOn(repository, 'findByNickname').mockResolvedValue(null);
      jest.spyOn(repository, 'findByPhoneNumber').mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      jest.spyOn(repository, 'create').mockResolvedValue(mockUser);

      // When: 회원가입
      const result = await service.create(createUserDto);

      // Then: 사용자 중복 검증
      expect(repository.findByEmail).toHaveBeenCalledWith(createUserDto.email);
      expect(repository.findByNickname).toHaveBeenCalledWith(
        createUserDto.nickname,
      );
      expect(repository.findByPhoneNumber).toHaveBeenCalledWith(
        createUserDto.phoneNumber,
      );

      // Then: 비밀번호 검증
      expect(bcrypt.hash).toHaveBeenCalledWith(createUserDto.password, 10);

      // Then: 사용자 생성 호출 검증
      expect(repository.create).toHaveBeenCalledWith({
        ...createUserDto,
        password: 'hashedPassword',
      });

      // Then: 비밀번호 제외하고 반환
      expect(result).not.toHaveProperty('password');
      // 생성된 사용자가 동일한 이메일로 생성되었는지 확인
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

      // Then: 이메일 체크가 호출되었는지 검증
      expect(repository.findByEmail).toHaveBeenCalledWith(createUserDto.email);

      // Then: 예외 발생 후 더 이상 진행하지 않았는지 검증
      expect(repository.findByNickname).not.toHaveBeenCalled();
      expect(repository.findByPhoneNumber).not.toHaveBeenCalled();
      expect(bcrypt.hash).not.toHaveBeenCalled();
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
      expect(repository.findByNickname).toHaveBeenCalledWith(
        createUserDto.nickname,
      );

      // Then: 예외 발생 후 더 이상 진행하지 않았는지 검증
      expect(repository.findByPhoneNumber).not.toHaveBeenCalled();
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
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jest.spyOn(repository, 'updateLastLogin').mockResolvedValue({
        ...mockUser,
        updatedAt: new Date(),
      });
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

      // Then: 로그인 시간 업데이트 검증
      expect(repository.updateLastLogin).toHaveBeenCalledWith(mockUser.id);

      // Then: JWT 토큰 생성 검증
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);

      // Then: 결과에 토큰과 사용자 정보 포함
      expect(result.user.email).toBe(loginUserDto.email);
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).not.toHaveProperty('password');
    });

    it('존재하지 않는 이메일로 로그인 시 UnauthorizedException 발생', async () => {
      // Given: 사용자 존재하지 않음
      jest.spyOn(repository, 'findByEmail').mockResolvedValue(null);

      // When & Then: 예외발생
      await expect(service.login(loginUserDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginUserDto)).rejects.toThrow(
        '이메일 또는 비밀번호가 일치하지 않습니다',
      );

      // Then: 이후 로직은 실행되지 않음
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(repository.updateLastLogin).not.toHaveBeenCalled();
    });

    it('비활성화된 계정으로 로그인 시 UnauthorizedException 발생', async () => {
      // Given: 비활성된 사용자
      const inactiveUser = { ...mockUser, isActive: false };
      jest.spyOn(repository, 'findByEmail').mockResolvedValue(inactiveUser);

      // When & Then
      await expect(service.login(loginUserDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginUserDto)).rejects.toThrow(
        '비활성화된 계정입니다',
      );

      // Then: 이메일로 사용자 찾기 실행 검증
      expect(repository.findByEmail).toHaveBeenCalledWith(loginUserDto.email);

      // Then: 예외 발생 이후 로직 호출 안됨 검증
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(repository.updateLastLogin);
    });

    it('비밀번호가 틀리면 UnauthorizedException 발생', async () => {
      // Given: 사용자 존재, 비밀번호 불일치
      jest.spyOn(repository, 'findByEmail').mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false); // 비밀번호 검증 실패

      // When & Then: 예외 발생
      await expect(service.login(loginUserDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginUserDto)).rejects.toThrow(
        '이메일 또는 비밀번호가 일치하지 않습니다',
      );

      // Then: 비밀번호 검증까지 실행됨
      expect(repository.findByEmail).toHaveBeenCalledWith(loginUserDto.email);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginUserDto.password,
        mockUser.password,
      );

      // Then: 비밀번호 검증 실패 후 더 이상 진행하지 않음
      expect(repository.updateLastLogin).not.toHaveBeenCalled();
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });
  describe('사용자 조회', () => {
    it('아이디로 사용자 조회', async () => {
      // Given: 사용자 존재
      jest.spyOn(repository, 'findById').mockResolvedValue(mockUser);

      // When: 사용자 조회
      const result = await service.findOne(mockUser.id);

      // Then: 비밀번호 제외 확인
      expect(result).not.toHaveProperty('password');
      expect(result.email).toBe(mockUser.email);
    });
    it('존재하지 않는 사용자로 로그인 시도 시 NotFoundException', async () => {
      // Given: 존재하지 않는 사용자
      jest.spyOn(repository, 'findById').mockResolvedValue(null);

      // when & Then: 사용자 조회
      await expect(service.findOne('notexist-userid')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('notexist-userid')).rejects.toThrow(
        '사용자를 찾을 수 없습니다',
      );
    });
  });

  describe('사용자 업데이트(정보 수정)', () => {
    const updateUserDto: UpdateUserDto = {
      nickname: '새닉네임',
      phoneNumber: '01099998888',
    };

    it('정상적으로 사용자 정보를 수정할 수 있다.', async () => {
      // Given: 사용자 존재, 중복 없음
      jest.spyOn(repository, 'findById').mockResolvedValue(mockUser);
      jest.spyOn(repository, 'findByNickname').mockResolvedValue(null);
      jest.spyOn(repository, 'findByPhoneNumber').mockResolvedValue(null);
      const updatedUser = {
        ...mockUser,
        ...updateUserDto,
      };
      jest.spyOn(repository, 'update').mockResolvedValue(updatedUser);

      // When: update 실행
      const result = await service.update(mockUser.id, updateUserDto);

      // Then: 사용자 존재 확인
      expect(repository.findById).toHaveBeenCalledWith(mockUser.id);
      // Then: 중복 확인
      expect(repository.findByNickname).toHaveBeenCalledWith(
        updateUserDto.nickname,
      );
      expect(repository.findByPhoneNumber).toHaveBeenCalledWith(
        updateUserDto.phoneNumber,
      );
      // Then: 사용자 정보 업데이트
      expect(repository.update).toHaveBeenCalledWith(
        mockUser.id,
        updateUserDto,
      );

      // Then: 수정된 정보 확인(password 없음)
      expect(result).not.toHaveProperty('password');
      expect(result.nickname).toBe(updateUserDto.nickname);
      expect(result.phoneNumber).toBe(updateUserDto.phoneNumber);
    });

    it('존재하지 않는 사용자 수정 시 NotFoundException 발생', async () => {
      // Given: 존재하지 않는 사용자
      const invalidUserId = 'invalid-id';
      jest.spyOn(repository, 'findById').mockResolvedValue(null);

      // When & Then: 예외 발생
      await expect(service.update(invalidUserId, updateUserDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.update(invalidUserId, updateUserDto)).rejects.toThrow(
        '사용자를 찾을 수 없습니다',
      );

      // Then: 사용자 조회 호출 검증
      expect(repository.findById).toHaveBeenCalledWith(invalidUserId);

      // Then: 예외 이후 함수 호출 안됨 검증
      expect(repository.findByNickname).not.toHaveBeenCalled();
      expect(repository.findByPhoneNumber).not.toHaveBeenCalled();
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('닉네임 중복 시 ConflictException 발생', async () => {
      // Given: 닉네임 중복 사용자
      jest.spyOn(repository, 'findById').mockResolvedValue(mockUser);
      const otherUser = {
        ...mockUser,
        id: 'other-user',
      };
      jest.spyOn(repository, 'findByNickname').mockResolvedValue(otherUser);

      // When & Then: 예외 발생
      await expect(service.update(mockUser.id, updateUserDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });
  describe('remove (회원 탈퇴)', () => {
    it('존재하지 않는 회원 탈퇴 시 NotFoundException', async () => {
      // Given: 존재하지 않는 회원
      jest.spyOn(repository, 'findById').mockResolvedValue(null);

      // When:
      await expect(service.remove(mockUser.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('이미 탈퇴한 회원은 BadRequestException', async () => {
      // Given: 이미 삭제한 회원
      const removedUser = {
        ...mockUser,
        isActive: false,
      };
      jest.spyOn(repository, 'findById').mockResolvedValue(removedUser);

      // When & Then
      await expect(service.remove(mockUser.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('거래 진행 중인 거래가 있는 회원은 ConflictException', async () => {
      // Given: 거래 진행 중인 회원, 소프트 삭제
      jest.spyOn(repository, 'findById').mockResolvedValue(mockUser);
      jest
        .spyOn(ordersService, 'hasOngoingOrdersByUserId')
        .mockResolvedValue(true);
      jest.spyOn(repository, 'softDelete').mockResolvedValue(mockUser);

      // When & Then: 예외 처리
      await expect(service.remove(mockUser.id)).rejects.toThrow(
        ConflictException,
      );
    });

    it('정상적으로 회원 탈퇴할 수 있다', async () => {
      // Given: 활성 회원, 진행 중인 거래 없음
      jest.spyOn(repository, 'findById').mockResolvedValue(mockUser);
      jest
        .spyOn(ordersService, 'hasOngoingOrdersByUserId')
        .mockResolvedValue(false);
      const deletedUser = {
        ...mockUser,
        isActive: false,
      };
      jest.spyOn(repository, 'softDelete').mockResolvedValue(deletedUser);

      // When: 회원 탈퇴
      const result = await service.remove(mockUser.id);

      // Then: 사용자 존재 및 활성 상태 확인 호출 검증
      expect(repository.findById).toHaveBeenCalledWith(mockUser.id);

      // Then: 진행 중인 주문 확인 호출 검증
      expect(ordersService.hasOngoingOrdersByUserId).toHaveBeenCalledWith(
        mockUser.id,
      );

      // Then: 소프트 삭제 로직 호출 검증
      expect(repository.softDelete).toHaveBeenCalledWith(mockUser.id);

      // Then: 삭제된 회원 정보 확인
      expect(result.isActive).toBe(false);
      expect(repository.softDelete).toHaveBeenCalledWith(mockUser.id);
    });
  });
});
