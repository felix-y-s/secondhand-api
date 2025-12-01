import { AppModule } from '@/app.module';
import { HttpExceptionFilter } from '@/common/filters';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import { PrismaService } from '@/prisma/prisma.service';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import request from 'supertest';
import { CreateUserDto } from './dto';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '@/common/auth';
import { TestDataFactory } from '@/test/fixtures/test-data.factory';

const prefix = '/api/v1';

const createUserDto: CreateUserDto = {
  email: `testuser@example.com`,
  password: 'Password123!',
  nickname: '테스트사용자',
  name: '테스트-사용자',
};

/**
 * 헬퍼 함수: 사용자 생성 및 로그인
 */
const createAndLoginUser = async (
  app: INestApplication,
  userDataDto: CreateUserDto,
) => {
  // 0. 테스트 계정이 이미 존재하면 제거
  await app.get(PrismaService).user.deleteMany({
    where: {
      email: userDataDto.email,
    },
  });

  // 1. 유저 생성
  const response = await request(app.getHttpServer())
    .post(`${prefix}/users/register`)
    .send(userDataDto)
    .expect(201);
  const userId = response.body.data.user.id;

  // 2. 로그인 요청
  const loginResponse = await request(app.getHttpServer())
    .post(`${prefix}/users/login`)
    .send({ email: userDataDto.email, password: userDataDto.password })
    .expect(200);
  const { accessToken, refreshToken } = loginResponse.body.data;

  // 3. 토큰 반환
  return { userId, accessToken, refreshToken };
};

/**
 * Users API E2E 테스트
 */
describe('Users API E2E 테스트', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let configService: ConfigService;
  let testDataFactory: TestDataFactory;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();

    app.setGlobalPrefix(prefix, {
      exclude: ['health', 'api-docs'],
    });

    app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true, // 자동 타입 변환
        },
      }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalGuards();

    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);
    configService = app.get<ConfigService>(ConfigService);
    testDataFactory = new TestDataFactory(prisma, configService, jwtService);
  });

  afterAll(async () => {
    // Factory가 생성한 모든 테스트 데이터 정리
    await testDataFactory.cleanupAll();
    await app.close();
  });

  /**
   * 회원가입
   */
  describe('POST /users/register (회원가입)', () => {
    let userId: string | undefined;

    beforeAll(async () => {});
    afterEach(async () => {
      if (userId) {
        await prisma.user.delete({ where: { id: userId } });
        userId = undefined;
      }
    });

    describe('성공 케이스', () => {
      it('회원가입', async () => {
        const response = await request(app.getHttpServer())
          .post(`${prefix}/users/register`)
          .send(createUserDto)
          .expect(201);

        const body = response.body;

        userId = body.data.user.id;

        expect(body.success).toBeTruthy();
        expect(body.data).toHaveProperty('accessToken');
        expect(body.data).toHaveProperty('refreshToken');

        // 토큰에서 사용자 아이디를 추출해서 실제 디비에 생성됐는지 확인
        // JWT 페이로드에서 userId 추출
        const accessToken = body.data.accessToken;
        const payload = JSON.parse(
          Buffer.from(accessToken.split('.')[1], 'base64').toString(),
        );
        const createdUserId = payload.sub;

        // DB 확인
        const userInDb = await prisma.user.findUnique({
          where: { id: createdUserId },
        });
        expect(userInDb).not.toBeNull();
        expect(userInDb?.email).toBe(createUserDto.email);
      });
    });

    describe('실패 케이스', () => {
      const timestamp = Date.now();
      const duplicateUserDto: CreateUserDto = {
        email: createUserDto.email,
        password: 'Password123!',
        nickname: `중복사용자-${timestamp}`,
      };
      let duplicateUserId: string;
      beforeAll(async () => {
        // 이메일 중복 사용자 생성
        duplicateUserId = (
          await prisma.user.create({
            data: duplicateUserDto,
          })
        ).id;
      });
      afterAll(async () => {
        if (duplicateUserId) {
          await prisma.user.delete({ where: { id: duplicateUserId } });
        }
      });

      it('이메일 중복 시 409 에러 발생', async () => {
        const response = await request(app.getHttpServer())
          .post(`${prefix}/users/register`)
          .send(duplicateUserDto)
          .expect(409);
        expect(response.body.success).toBeFalsy();
      });

      it('잘못된 이메일 형식 시 400 에러 발생', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/v1/users/register')
          .send({
            email: 'invalid-email', // 잘못된 형식
            password: 'Password123!',
            nickname: `테스터-${timestamp}`,
          })
          .expect(400);
        expect(response.body.success).toBeFalsy();
      });
    });
  });

  /**
   * 로그인
   */
  describe('POST /users/login (로그인)', () => {
    let testUserId: string;
    beforeAll(async () => {
      const user = await createAndLoginUser(app, createUserDto);
      testUserId = user.userId;
    });
    afterAll(async () => {
      await prisma.user.delete({ where: { id: testUserId } });
    });

    describe('성공 케이스', () => {
      it('로그인', async () => {
        const response = await request(app.getHttpServer())
          .post(`${prefix}/users/login`)
          .send({
            email: createUserDto.email,
            password: createUserDto.password,
          })
          .expect(200);

        const body = response.body;

        expect(body.success).toBeTruthy();
        expect(body.data.user.id).toBe(testUserId);
        expect(body.data.accessToken).toBeDefined();
        expect(body.data.refreshToken).toBeDefined();
        expect(body.data.user).toHaveProperty('email');
        expect(body.data.user).not.toHaveProperty('password');

        // DB 확인
        const payload = JSON.parse(
          Buffer.from(body.data.accessToken.split('.')[1], 'base64').toString(),
        );
        expect(payload.sub).toBe(testUserId);
      });
    });

    describe('실패 케이스', () => {
      it('비활성화 계정', async () => {
        // 테스트 계정 비활성화
        await prisma.user.update({
          where: { email: createUserDto.email },
          data: { isActive: false },
        });

        const response = await request(app.getHttpServer())
          .post(`${prefix}/users/login`)
          .send({
            email: createUserDto.email,
            password: createUserDto.password,
          })
          .expect(401);
        const body = response.body;
        expect(body.success).toBeFalsy();
        expect(body.error).toBeDefined();
      });
      it('비밀번호 불일치', async () => {
        // 테스트 계정 활성화
        await prisma.user.update({
          where: { email: createUserDto.email },
          data: { isActive: true },
        });

        const response = await request(app.getHttpServer())
          .post(`${prefix}/users/login`)
          .send({
            email: createUserDto.email,
            password: 'notmatch123!',
          })
          .expect(401);
        const body = response.body;

        expect(body.success).toBeFalsy();
        expect(body.error).toBeDefined();
        expect(body.error.message).toBe(
          '이메일 또는 비밀번호가 일치하지 않습니다',
        );
      });
    });
  });

  /**
   * 토큰 재발급
   */
  describe('POST /users/refresh (토큰 재발급)', () => {
    let testUserId: string;
    let refreshToken: string;
    beforeAll(async () => {
      const user = await createAndLoginUser(app, createUserDto);
      testUserId = user.userId;
      refreshToken = user.refreshToken;

      // 1초 대기 (iat 변경을 위해)
      // - 페이로드(내용)가 같고, 시크릿 키가 같고, iat까지 같다면(1초미만) 생성되는 토큰 문자열은 100% 동일
      await new Promise((resolve) => setTimeout(resolve, 1000));
    });
    afterAll(async () => {
      await prisma.user.delete({ where: { id: testUserId } });
    });

    describe('성공 케이스', () => {
      it('토큰 재발급', async () => {
        const response = await request(app.getHttpServer())
          .post(`${prefix}/users/refresh`)
          .set('Authorization', `Bearer ${refreshToken}`)
          .expect(200);

        expect(response.body.data.accessToken).toBeDefined();
        expect(response.body.data.refreshToken).toBeDefined();
        // 기존 refreshToken과 새로 발급받은 refreshToken은 서로 달라야 한다.
        expect(response.body.data.refreshToken).not.toEqual(refreshToken);
      });
    });

    describe('실패 케이스', () => {
      it('존재하지 않는 사용자', async () => {
        // 존재하지 않는 사용자 리플레시 토큰 생성
        
        const refreshToken = await jwtService.signAsync(
          {
            sub: 'not-exist-testUserId',
            email: 'not-exist-email@example.com',
            role: Role.USER,
            type: 'refresh',
          },
          {
            secret: configService.get<string>('JWT_REFRESH_SECRET'),
            expiresIn: '7d',
          },
        );

        const res = await request(app.getHttpServer())
          .post(`${prefix}/users/refresh`)
          .set('Authorization', `Bearer ${refreshToken}`)
          .expect(404);

        expect(res.body.success).toBeFalsy();
        expect(res.body.error.message).toBe('사용자를 찾을 수 없습니다');
      });
      it('비활성화(탈퇴)된 사용자', async () => {
        // Given: 테스트 계정을 비활성화 처리
        await prisma.user.update({
          where: { id: testUserId },
          data: { isActive: false },
        });

        const res = await request(app.getHttpServer())
          .post(`${prefix}/users/refresh`)
          .set('Authorization', `Bearer ${refreshToken}`)
          .expect(401);

        expect(res.body.success).toBeFalsy();
        expect(res.body.error.message).toBe('비활성화된 계정입니다');
      });
      it('만료된 리플래시 토큰으로 요청', async () => {
        // REMIND: ⭐️ jwt 실제 동작 흐름
        /** 
        1. 클라이언트 요청 → Guard의 canActivate()
        2. super.canActivate() → Passport Strategy 실행
        3. passport-jwt 라이브러리가 토큰 검증
          - 만료 확인 (ignoreExpiration: false)
          - 서명 확인
          - 디코딩
        4. ❌ 만료된 토큰 → passport-jwt에서 에러 발생
        5. 하지만 에러가 handleRequest의 err 파라미터로 전달되지 않음!
        6. 대신 user가 null이 됨
       */
        // 만료된 리플레시 토큰 생성
        const expiredToken = await jwtService.signAsync(
          {
            sub: 'not-exist-userId',
            email: createUserDto.email,
            role: Role.USER,
            type: 'refresh',
          },
          {
            secret: configService.get<string>('JWT_REFRESH_SECRET'),
            expiresIn: '-1h',
          },
        );

        const response = await request(app.getHttpServer())
          .post(`${prefix}/users/refresh`)
          .set('Authorization', `Bearer ${expiredToken}`)
          .expect(401);

        const body = response.body;
        expect(body.success).toBeFalsy();
        expect(body.error.message).toContain('jwt expired');
      });
    });
  });

  /**
   * 내 정보 조회
   */
  describe('GET /users/me (내 정보 조회)', () => {
    let testUserId: string;
    let accessToken: string;
    beforeAll(async () => {
      // 테스트 회원가입
      const user = await createAndLoginUser(app, createUserDto);
      testUserId = user.userId;
      accessToken = user.accessToken;
    });
    afterAll(async () => {
      if (testUserId) {
        await prisma.user.delete({ where: { id: testUserId } });
      }
    });
    describe('성공 케이스', () => {
      it('내 정보 조회', async () => {
        const response = await request(app.getHttpServer())
          .get(`${prefix}/users/me`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body.data.id).toBe(testUserId);
      });
    });

    describe('실패 케이스', () => {
      it('존재하지 않는 사용자', async () => {
        const notExistUserToken = await jwtService.signAsync(
          {
            sub: 'notExistUserId',
            email: 'notExistUser@example.com',
            role: Role.USER,
            type: 'access',
          },
          {
            secret: configService.get<string>('JWT_SECRET'),
            expiresIn: '1h',
          },
        );

        const res = await request(app.getHttpServer())
          .get(`${prefix}/users/me`)
          .set('Authorization', `Bearer ${notExistUserToken}`)
          .expect(404);
        expect(res.body.success).toBeFalsy();
        expect(res.body.error.message).toBe('사용자를 찾을 수 없습니다')
      });
      it('만료된 토큰으로 조회 시도', async () => {
        // Given: 만료된 토큰 생성
        const secret = configService.get<string>('jwt.secret');
        const expiredPaylod: JwtPayload = {
          sub: testUserId,
          email: createUserDto.email,
          role: Role.USER,
          type: 'access'
        }
        const expiredToken = await jwtService.signAsync(expiredPaylod, {
          secret,
          expiresIn: '-1h'
        })

        const res = await request(app.getHttpServer())
          .get(`${prefix}/users/me`)
          .set('Authorization', `Bearer ${expiredToken}`)
          .expect(401);
        expect(res.body.success).toBeFalsy();
        expect(res.body.error.message).toContain('jwt expired');
      });
    });
  });

  /**
   * 내 정보 수정
   */
  describe('PATCH /users/me (내 정보 수정)', () => {
    let testUserId: string;
    let accessToken: string;
    beforeAll(async () => {
      // 테스트 회원가입
      const user = await createAndLoginUser(app, createUserDto);
      testUserId = user.userId;
      accessToken = user.accessToken;
    });
    afterAll(async () => {
      if (testUserId) {
        await prisma.user.delete({ where: { id: testUserId } });
      }
    });
    describe('성공 케이스', () => {
      it('내 정보 수정', async () => {
        const response = await request(app.getHttpServer())
          .patch(`${prefix}/users/me`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            nickname: 'test',
            name: 'test',
            phoneNumber: '0101112222',
            profileImage: 'test.jpg',
            bio: 'test',
          })
          .expect(200);

        expect(response.body.data.id).toBe(testUserId);
      });
    });

    describe('실패 케이스', () => {
      it('존재하지 않는 사용자', async () => {
        const testPaylod: JwtPayload = {
          sub: 'notExistUserId',
          email: 'notExistUser@example.com',
          role: Role.USER,
          type: 'access'
        }
        const notExistToken = await jwtService.signAsync(testPaylod, {
          secret: configService.get<string>('JWT_SECRET'),
          expiresIn: '1h',
        })
        const response = await request(app.getHttpServer())
          .patch(`${prefix}/users/me`)
          .set('Authorization', `Bearer ${notExistToken}`)
          .send({
            nickname: 'test',
            name: 'test',
            phoneNumber: '0101112222',
            profileImage: 'test.jpg',
            bio: 'test',
          })
          .expect(404);

        expect(response.body.success).toBeFalsy();
        expect(response.body.error.message).toBe('사용자를 찾을 수 없습니다');
      });
      it('비활성화된 사용자', async () => {
        
      });
    });
  });

  /**
   * 회원 탈퇴
   */
  describe('DELETE /users/me (회원 탈퇴)', () => {
    let userId: string;
    let accessToken: string;

    beforeAll(async () => {
      ({ userId, accessToken } = await createAndLoginUser(app, createUserDto));
    });
    afterAll(async () => {
      if (userId) {
        await prisma.user.delete({ where: { id: userId } });
      }
    });

    describe('성공 케이스', () => {
      it('회원 탈퇴', async () => {
        const response = await request(app.getHttpServer())
          .delete(`${prefix}/users/me`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe('실패 케이스', () => {
      it('존재하지 않는 사용자', async () => {
        const testPaylod: JwtPayload = {
          sub: 'notExistUserId',
          email: 'notExistUser@example.com',
          role: Role.USER,
          type: 'access'
        }
        const notExistToken = await jwtService.signAsync(testPaylod, {
          secret: configService.get<string>('JWT_SECRET'),
          expiresIn: '1h',
        })
        const response = await request(app.getHttpServer())
          .delete(`${prefix}/users/me`)
          .set('Authorization', `Bearer ${notExistToken}`)
          .expect(404);

        expect(response.body.success).toBeFalsy();
        expect(response.body.error.message).toBe('사용자를 찾을 수 없습니다');
      });
      it('이미 탈퇴한 사용자', async () => {
        // Factory 패턴: 비활성 사용자 생성
        const inactiveUser = await testDataFactory.createInactiveUser();

        // JWT 토큰 생성 (비활성 사용자용)
        const payload: JwtPayload = {
          sub: inactiveUser.id,
          email: inactiveUser.email,
          role: inactiveUser.role,
          type: 'access',
        };
        const secret = configService.get<string>('JWT_SECRET') || 'your-secret-key';
        const token = jwtService.sign(payload, { secret });

        // 탈퇴 시도 - 로그인 자체가 안되지만, 만약 이전 토큰이 있다면?
        const response = await request(app.getHttpServer())
          .delete(`${prefix}/users/me`)
          .set('Authorization', `Bearer ${token}`)
          .expect(400);

        expect(response.body.success).toBeFalsy();
        expect(response.body.error.message).toBe('이미 탈퇴한 계정입니다');
      });

      it('진행중인 주문이 있으면 탈퇴 실패', async () => {
        // ✅ Factory 패턴: 한 줄로 복잡한 시나리오 생성
        const { buyer } = await testDataFactory.createUserWithOngoingOrder();

        // 로그인 (비밀번호는 Factory에서 기본값 'Test1234!' 사용)
        const loginResponse = await request(app.getHttpServer())
          .post(`${prefix}/users/login`)
          .send({
            email: buyer.email,
            password: 'Test1234!',
          })
          .expect(200);

        const { accessToken } = loginResponse.body.data;

        // 탈퇴 시도 - 진행중인 주문이 있어서 실패해야 함
        const response = await request(app.getHttpServer())
          .delete(`${prefix}/users/me`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(409);

        expect(response.body.success).toBeFalsy();
        expect(response.body.error.message).toContain('진행 중인 거래');
      });

      it('완료된 주문만 있으면 탈퇴 성공', async () => {
        // ✅ Factory 패턴: 완료된 주문 시나리오
        const { buyer } = await testDataFactory.createUserWithCompletedOrder();

        const loginResponse = await request(app.getHttpServer())
          .post(`${prefix}/users/login`)
          .send({
            email: buyer.email,
            password: 'Test1234!',
          })
          .expect(200);

        const { accessToken } = loginResponse.body.data;

        // 탈퇴 시도 - 완료된 주문만 있으므로 성공해야 함
        const response = await request(app.getHttpServer())
          .delete(`${prefix}/users/me`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body.success).toBeTruthy();
        expect(response.body.message).toBe('회원 탈퇴가 완료되었습니다');
      });

      it('주문 없는 사용자는 즉시 탈퇴', async () => {
        // ✅ Factory 패턴: 깨끗한 사용자
        const cleanUser = await testDataFactory.createCleanUser();

        const loginResponse = await request(app.getHttpServer())
          .post(`${prefix}/users/login`)
          .send({
            email: cleanUser.email,
            password: 'Test1234!',
          })
          .expect(200);

        const { accessToken } = loginResponse.body.data;

        // 탈퇴 시도 - 주문 없으므로 즉시 성공
        const response = await request(app.getHttpServer())
          .delete(`${prefix}/users/me`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body.success).toBeTruthy();
      })
      
    });
  });
});
