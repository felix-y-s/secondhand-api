import { PrismaService } from '@/prisma/prisma.service';
import { UsersService } from './users.service';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersRepository } from './repositories/users.repository';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OrdersService } from '../orders/orders.service';
import { OrdersRepository } from '../orders/repositories/orders.repository';
import { ProductsRepository } from '../products/repositories/products.repository';
import { ConflictException } from '@nestjs/common';
import { CreateUserDto } from './dto';
import { User } from '@prisma/client';

describe('Users 모듈 통합 테스트', () => {
  let usersService: UsersService;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let configService: ConfigService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [],
      providers: [
        UsersService,
        UsersRepository,
        JwtService,
        ConfigService,
        OrdersService,
        OrdersRepository,
        PrismaService,
        ProductsRepository,
      ],
    }).compile();

    usersService = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('회원가입', () => {
    let createUserDto: CreateUserDto;

    // 각 테스트 스위트 실행마다 고유한 데이터 생성
    beforeAll(() => {
      const timestamp = Date.now();
      createUserDto = {
        email: `integration-test-${timestamp}@example.com`,
        password: 'Password123!',
        nickname: `통합테스트-${timestamp}`,
        name: '테스터',
        phoneNumber: `010${timestamp.toString().slice(-8)}`,
      };
    });

    describe('회원가입 성공', () => {
      let createdUserId: string;

      it('정상 회원가입', async () => {
        const createdUser = await usersService.create(createUserDto);

        expect(createdUser.email).toBe(createUserDto.email);
        createdUserId = createdUser.id;

        // DB에서 직접확인
        const foundUser = await prisma.user.findUnique({
          where: {
            email: createUserDto.email,
          },
        });
        expect(foundUser?.email).toBe(createUserDto.email);
      });
    });

    describe('회원가입 실패', () => {
      let baseUserId: string;

      // 모든 테스트 전에 한 번만 기본 유저 생성
      beforeAll(async () => {
        // 혹시 이전 테스트에서 남은 유저가 있다면 삭제
        const existingUser = await prisma.user.findUnique({
          where: { email: createUserDto.email },
        });
        console.log('🚀 | beforeAll | existingUser:', existingUser);
        if (existingUser) {
          await prisma.user.delete({ where: { id: existingUser.id } });
        }

        // 새로운 기본 유저 생성
        const user = await prisma.user.create({ data: createUserDto });
        baseUserId = user.id;
      });

      // 모든 테스트 후 기본 유저 삭제
      afterAll(async () => {
        console.log('🚀 | afterAll | baseUserId:', baseUserId);
        if (baseUserId) {
          await prisma.user.delete({ where: { id: baseUserId } });
        }
      });

      it('이메일 중복 시 회원가입 실패 ConflictException', async () => {
        // 이메일만 중복, 나머지는 고유한 값 사용
        const newUserDto = {
          email: createUserDto.email, // 기존 유저와 동일 (중복!)
          password: 'Password123!',
          nickname: `unique-nickname-${Date.now()}`,
          name: '테스터2',
          phoneNumber: `01099${Date.now().toString().slice(-6)}`,
        };

        await expect(usersService.create(newUserDto)).rejects.toThrow(
          ConflictException,
        );
        await expect(usersService.create(newUserDto)).rejects.toThrow(
          '이미 사용 중인 이메일입니다',
        );
      });

      it('닉네임 중복 시 회원가입 실패', async () => {
        // 닉네임만 중복, 이메일과 전화번호는 고유한 값 사용
        const newUserDto = {
          email: `unique-email-${Date.now()}@example.com`,
          password: 'Password123!',
          nickname: createUserDto.nickname, // 기존 유저와 동일 (중복!)
          name: '테스터3',
          phoneNumber: `01088${Date.now().toString().slice(-6)}`,
        };

        await expect(usersService.create(newUserDto)).rejects.toThrow(
          ConflictException,
        );
        await expect(usersService.create(newUserDto)).rejects.toThrow(
          '이미 사용 중인 닉네임입니다',
        );
      });

      it('전화번호 중복 시 회원가입 실패', async () => {
        // 전화번호만 중복, 이메일과 닉네임은 고유한 값 사용
        const newUserDto = {
          email: `unique-email-phone-${Date.now()}@example.com`,
          password: 'Password123!',
          nickname: `unique-nickname-phone-${Date.now()}`,
          name: '테스터4',
          phoneNumber: createUserDto.phoneNumber, // 기존 유저와 동일 (중복!)
        };

        await expect(usersService.create(newUserDto)).rejects.toThrow(
          ConflictException,
        );
        await expect(usersService.create(newUserDto)).rejects.toThrow(
          '이미 사용 중인 전화번호입니다',
        );
      });
    });
  });

  describe('회원 탈퇴', () => {
    let testSellerId: string;
    let testBuyerId: string;
    let testCategoryId: string;
    let testProductId: string;
    let testOrderId: string;
    const password = 'Password123!';

    // 공통 데이터: 모든 테스트에서 공유
    beforeAll(async () => {
      const timestamp = Date.now();

      // Category: 모든 테스트에서 공유
      testCategoryId = (
        await prisma.category.create({
          data: {
            name: `테스트-카테고리-${timestamp}`,
            slug: `test-category-${timestamp}`,
          },
        })
      ).id;

      // Buyer: 주문 관련 테스트에서 공유
      testBuyerId = (
        await prisma.user.create({
          data: {
            email: `test-buyer-${timestamp}@test.com`,
            password,
            nickname: `테스트-구매자-${timestamp}`,
          },
        })
      ).id;
    });

    // 공통 데이터 정리
    afterAll(async () => {
      try {
        await prisma.user.deleteMany({ where: { id: testBuyerId } });
        await prisma.category.deleteMany({ where: { id: testCategoryId } });
      } catch (error) {
        console.error('❌ 공통 테스트 데이터 정리 실패:', error);
      }
    });

    describe('실패 케이스', () => {
      beforeAll(async () => {
        const timestamp = Date.now();

        // Seller, Product, Order는 이 테스트에서만 사용
        testSellerId = (
          await prisma.user.create({
            data: {
              email: `test-seller-${timestamp}@test.com`,
              password,
              nickname: `테스트-판매자-${timestamp}`,
            },
          })
        ).id;

        testProductId = (
          await prisma.product.create({
            data: {
              sellerId: testSellerId,
              categoryId: testCategoryId,
              title: `테스트-상품-${timestamp}`,
              description: '테스트용 상품',
              price: 10000,
              condition: 'GOOD',
            },
          })
        ).id;

        testOrderId = (
          await prisma.order.create({
            data: {
              productId: testProductId,
              buyerId: testBuyerId,
              sellerId: testSellerId,
              orderNumber: `ORD-${timestamp}`,
              totalAmount: 10000,
              status: 'PAID',
            },
          })
        ).id;
      });

      afterAll(async () => {
        try {
          await prisma.order.deleteMany({ where: { id: testOrderId } });
          await prisma.product.deleteMany({ where: { id: testProductId } });
          await prisma.user.deleteMany({ where: { id: testSellerId } });
        } catch (error) {
          console.error('❌ 테스트 데이터 정리 실패:', error);
        }
      });

      it('사용자가 없으면 NotFoundException 발생', async () => {
        await expect(usersService.remove('nonexistent-id')).rejects.toThrow(
          '사용자를 찾을 수 없습니다.',
        );
      });

      it('진행 중인 주문(PAID)이 있으면 탈퇴 불가', async () => {
        await expect(usersService.remove(testSellerId)).rejects.toThrow(
          '진행 중인 거래가 있어 탈퇴할 수 없습니다. 모든 거래를 완료하거나 취소해주세요.',
        );
      });
    });

    describe('성공 케이스 - PENDING 주문 자동 취소', () => {
      beforeAll(async () => {
        const timestamp = Date.now();

        testSellerId = (
          await prisma.user.create({
            data: {
              email: `test-seller-${timestamp}@test.com`,
              password,
              nickname: `테스트-판매자-${timestamp}`,
            },
          })
        ).id;

        testProductId = (
          await prisma.product.create({
            data: {
              sellerId: testSellerId,
              categoryId: testCategoryId,
              title: `테스트-상품-${timestamp}`,
              description: '테스트용 상품',
              price: 10000,
              condition: 'GOOD',
              status: 'ACTIVE',
            },
          })
        ).id;

        testOrderId = (
          await prisma.order.create({
            data: {
              productId: testProductId,
              buyerId: testBuyerId,
              sellerId: testSellerId,
              orderNumber: `ORD-${timestamp}`,
              totalAmount: 10000,
              status: 'PENDING',
            },
          })
        ).id;
      });

      afterAll(async () => {
        try {
          await prisma.order.deleteMany({ where: { id: testOrderId } });
          await prisma.product.deleteMany({ where: { id: testProductId } });
          await prisma.user.deleteMany({ where: { id: testSellerId } });
        } catch (error) {
          console.error('❌ 테스트 데이터 정리 실패:', error);
        }
      });

      it('판매자 탈퇴 시 PENDING 주문은 CANCELLED로 변경', async () => {
        await usersService.remove(testSellerId);

        const deletedUser = await prisma.user.findUnique({
          where: { id: testSellerId },
        });
        expect(deletedUser?.isActive).toBe(false);

        const cancelledOrder = await prisma.order.findUnique({
          where: { id: testOrderId },
        });
        expect(cancelledOrder?.status).toBe('CANCELLED');

        const deletedProduct = await prisma.product.findUnique({
          where: { id: testProductId },
        });
        expect(deletedProduct?.status).toBe('DELETED');
      });
    });

    describe('성공 케이스 - PAYMENT_PENDING 주문 자동 취소', () => {
      beforeAll(async () => {
        const timestamp = Date.now();

        testSellerId = (
          await prisma.user.create({
            data: {
              email: `test-seller-${timestamp}@test.com`,
              password,
              nickname: `테스트-판매자-${timestamp}`,
            },
          })
        ).id;

        testProductId = (
          await prisma.product.create({
            data: {
              sellerId: testSellerId,
              categoryId: testCategoryId,
              title: `테스트-상품-${timestamp}`,
              description: '테스트용 상품',
              price: 10000,
              condition: 'GOOD',
              status: 'ACTIVE',
            },
          })
        ).id;

        testOrderId = (
          await prisma.order.create({
            data: {
              productId: testProductId,
              buyerId: testBuyerId,
              sellerId: testSellerId,
              orderNumber: `ORD-${timestamp}`,
              totalAmount: 10000,
              status: 'PAYMENT_PENDING',
            },
          })
        ).id;
      });

      afterAll(async () => {
        try {
          await prisma.order.deleteMany({ where: { id: testOrderId } });
          await prisma.product.deleteMany({ where: { id: testProductId } });
          await prisma.user.deleteMany({ where: { id: testSellerId } });
        } catch (error) {
          console.error('❌ 테스트 데이터 정리 실패:', error);
        }
      });

      it('판매자 탈퇴 시 PAYMENT_PENDING 주문은 CANCELLED로 변경', async () => {
        await usersService.remove(testSellerId);

        // const product = await prisma.product.findUnique({
        //   where: { id: testProductId },
        // });

        const cancelledOrder = await prisma.order.findUnique({
          where: { id: testOrderId },
        });
        expect(cancelledOrder?.status).toBe('CANCELLED');
      });
    });

    describe('이미 삭제된 계정', () => {
      let deletedUserId: string;

      beforeAll(async () => {
        const timestamp = Date.now();

        // 사용자 생성 후 즉시 삭제
        deletedUserId = (
          await prisma.user.create({
            data: {
              email: `deleted-user-${timestamp}@test.com`,
              password,
              nickname: `삭제된사용자-${timestamp}`,
              isActive: false, // 이미 삭제된 상태
            },
          })
        ).id;
      });

      afterAll(async () => {
        try {
          await prisma.user.deleteMany({ where: { id: deletedUserId } });
        } catch (error) {
          console.error('❌ 테스트 데이터 정리 실패:', error);
        }
      });

      it('이미 탈퇴한 계정은 재탈퇴 불가', async () => {
        await expect(usersService.remove(deletedUserId)).rejects.toThrow(
          '이미 탈퇴한 계정입니다.',
        );
      });
    });
  });

  describe('사용자 조회', () => {
    let testUserId: string;
    beforeAll(async () => {
      const timestamp = Date.now();
      testUserId = (
        await prisma.user.create({
          data: {
            email: `test-user-${timestamp}@test.com`,
            password: 'password',
            nickname: `테스트-사용자-${timestamp}`,
          },
        })
      ).id;
    });
    afterAll(async () => {
      try {
        await prisma.user.deleteMany({ where: { id: testUserId } });
      } catch (error) {
        console.error('❌ 테스트 데이터 정리 실패:', error);
      }
    });
    it('존재하지 않는 사용자 조회 시 NotFoundException 발생', async () => {
      await expect(usersService.findOne('nonexistent-id')).rejects.toThrow(
        '사용자를 찾을 수 없습니다',
      );
    });
    it('사용자 조회 성공', async () => {
      const user = await usersService.findOne(testUserId);
      expect(user).toBeDefined();
      expect(user.id).toBe(testUserId);
    });
  });

  describe('사용자 정보 수정', () => {
    let updateUser: User;
    let existingUser: User;
    beforeAll(async () => {
      const timestamp = Date.now();
      existingUser = await prisma.user.create({
        data: {
          email: `test-user-1-${timestamp}@test.com`,
          password: 'password',
          nickname: `테스트-사용자-1-${timestamp}`,
          phoneNumber: `01012345678`,
        },
      });
      updateUser = await prisma.user.create({
        data: {
          email: `test-user-2-${timestamp}@test.com`,
          password: 'password',
          nickname: `테스트-사용자-2-${timestamp}`,
          phoneNumber: `01012345679`,
        },
      });
    });
    afterAll(async () => {
      try {
        await prisma.user.deleteMany({ where: { id: existingUser.id } });
        await prisma.user.deleteMany({ where: { id: updateUser.id } });
      } catch (error) {
        console.error('❌ 테스트 데이터 정리 실패:', error);
      }
    });
    it('존재하지 않는 사용자 정보 수정 시 NotFoundException 발생', async () => {
      await expect(
        usersService.update('nonexistent-id', { nickname: 'new-nickname' }),
      ).rejects.toThrow('사용자를 찾을 수 없습니다');
    });

    it('닉네임 중복 시 ConflictException 발생', async () => {
      await expect(
        usersService.update(updateUser.id, { nickname: existingUser.nickname }),
      ).rejects.toThrow('이미 사용 중인 닉네임입니다');
    });

    it('전화번호 중복 시 ConflictException 발생', async () => {
      await expect(
        usersService.update(updateUser.id, {
          phoneNumber: existingUser.phoneNumber!,
        }),
      ).rejects.toThrow('이미 사용 중인 전화번호입니다');
    });

    it('사용자 정보 수정 성공', async () => {
      const user = await usersService.update(updateUser.id, {
        nickname: 'new-nickname',
      });
      expect(user).toBeDefined();
      expect(user.id).toBe(updateUser.id);
      expect(user.nickname).toBe('new-nickname');
    });
  });

  describe('JWT 토큰 재발행', () => {
    let testUserId: string;
    let refreshToken: string;

    const timestamp = Date.now();
    const createUserDto: CreateUserDto = {
      email: `refresh-test-${timestamp}@example.com`,
      password: 'Password123!',
      nickname: `닉네임-${timestamp}`,
    };

    beforeAll(async () => {
      // 회원등록 후 refresh token 획득
      const loginUser = await usersService.create(createUserDto);
      testUserId = loginUser.id;

      const loginInfo = await usersService.login({
        email: createUserDto.email,
        password: createUserDto.password,
      });
      refreshToken = loginInfo.refreshToken;
    });
    afterAll(async () => {
      try {
        await prisma.user.deleteMany({ where: { id: testUserId } });
      } catch (error) {
        console.error('❌ 테스트 데이터 정리 실패:', error);
      }
    });

    it('토큰 재발행 성공', async () => {
      const jwtToken =
        await usersService.refreshAccessToken(refreshToken);

      expect(jwtToken.accessToken).toBeDefined();
      expect(jwtToken.refreshToken).toBeDefined();
    });

    it('만료된 토큰으로 토큰 재발행 시 JsonWebTokenError 발생', async () => {
      const expiredToken = await jwtService.signAsync(
        {
          sub: testUserId,
          email: createUserDto.email,
          role: 'USER',
          type: 'refresh',
        },
        {
          secret: configService.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: '-1s', // 만료된 토큰 생성
        },
      );

      await expect(
        usersService.refreshAccessToken(expiredToken),
      ).rejects.toThrow('만료된 토큰입니다');
    });

    it('유효하지 않은 토큰으로 토큰 재발행 시 UnauthorizedException 발생', async () => {
      await expect(
        usersService.refreshAccessToken('invalid-refresh-token'),
      ).rejects.toThrow('유효하지 않은 토큰입니다');
    });

    it('비활성화된 계정으로 토큰 재발행 시 UnauthorizedException 발생', async () => {
      await prisma.user.update({
        where: { id: testUserId },
        data: { isActive: false },
      });

      await expect(
        usersService.refreshAccessToken(refreshToken),
      ).rejects.toThrow('비활성화된 계정입니다');
    });
  });
});
