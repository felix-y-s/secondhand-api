import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth.module';
import { AuthGuardTestController } from './__test__/auth-guard-test.controller';
import { Role } from '@prisma/client';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import configuration from '@/config/configuration';
import { validationSchema } from '@/config/validation.schema';

describe('JwtAuthGuard (E2E)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let configService: ConfigService;

  beforeAll(async () => {
    // Clear env vars that might be preloaded by the environment/tools
    delete process.env.JWT_SECRET;
    delete process.env.JWT_EXPIRES_IN;
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.JWT_REFRESH_EXPIRES_IN;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
          validationSchema,
          validationOptions: {
            allowUnknown: true,
            abortEarly: false,
          },
          // 환경별 파일 로드
          // NODE_ENV에 따라 적절한 파일 선택
          envFilePath:
            process.env.NODE_ENV === 'test'
              ? ['.env.test', '.env.development', '.env']
              : ['.env.development', '.env'],
          expandVariables: true,
        }),
        AuthModule,
      ],
      controllers: [AuthGuardTestController],
      providers: [
        ConfigService,
        {
          provide: APP_GUARD, // @Public() 데코레이터 확인을 위해서 전역으로 Guard 등록
          useClass: JwtAuthGuard,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
      }),
    );

    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    configService = moduleFixture.get<ConfigService>(ConfigService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('@Public() 데코레이터', () => {
    it('Public 엔드포인트는 토큰 없이 접근 가능하다', () => {
      return request(app.getHttpServer())
        .get('/test/auth/public')
        .expect(200)
        .expect({
          message: 'public endpoint',
        });
    });
  });

  describe('JWT Access Token 인증', () => {
    describe('성공 케이스', () => {
      it('유효한 Access Token으로 보호된 엔드포인트에 접근한다', async () => {
        // Given: 유효한 Access Token
        const payload = {
          sub: 'user-123',
          email: 'test@example.com',
          role: Role.USER,
          type: 'access',
        };
        const accessToken = jwtService.sign(payload, {
          secret: configService.get('jwt.secret'),
          expiresIn: configService.get('jwt.expiresIn'),
        });

        // When & Then
        return request(app.getHttpServer())
          .get('/test/auth/protected')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.message).toBe('protected endpoint');
            expect(res.body.user).toMatchObject({
              userId: 'user-123',
              email: 'test@example.com',
              role: Role.USER,
            });
          });
      });
    });

    describe('실패 케이스 - 토큰 없음/형식 오류', () => {
      it('토큰이 없으면 401 에러를 반환한다', () => {
        return request(app.getHttpServer())
          .get('/test/auth/protected')
          .expect(401)
          .expect((res) => {
            expect(res.body.message).toContain('인증');
          });
      });

      it('Bearer 스키마가 없으면 401 에러를 반환한다', () => {
        return request(app.getHttpServer())
          .get('/test/auth/protected')
          .set('Authorization', 'invalid-token-without-bearer')
          .expect(401);
      });

      it('잘못된 형식의 토큰이면 401 에러를 반환한다', () => {
        return request(app.getHttpServer())
          .get('/test/auth/protected')
          .set('Authorization', 'Bearer not.a.valid.jwt')
          .expect(401)
          .expect((res) => {
            expect(res.body.message).toContain('jwt 인증오류');
          });
      });
    });

    describe('실패 케이스 - 토큰 만료', () => {
      it('만료된 토큰이면 401 에러를 반환한다', async () => {
        // Given: 만료된 토큰 생성
        const payload = {
          sub: 'user-expired',
          email: 'expired@example.com',
          role: Role.USER,
          type: 'access',
        };
        const expiredToken = jwtService.sign(payload, {
          secret: configService.get('jwt.secret'),
          expiresIn: '-1s', // 이미 만료됨
        });

        // When & Then
        return request(app.getHttpServer())
          .get('/test/auth/protected')
          .set('Authorization', `Bearer ${expiredToken}`)
          .expect(401)
          .expect((res) => {
            expect(res.body.message).toContain('jwt expired');
          });
      });
    });

    describe('실패 케이스 - 잘못된 서명', () => {
      it('다른 secret으로 서명된 토큰이면 401 에러를 반환한다', async () => {
        // Given: 잘못된 secret으로 서명
        const payload = {
          sub: 'user-wrong-secret',
          email: 'wrong@example.com',
          role: Role.USER,
          type: 'access',
        };
        const wrongToken = jwtService.sign(payload, {
          secret: 'wrong-secret-key', // 다른 secret
          expiresIn: '1d',
        });

        // When & Then
        return request(app.getHttpServer())
          .get('/test/auth/protected')
          .set('Authorization', `Bearer ${wrongToken}`)
          .expect(401)
          .expect((res) => {
            expect(res.body.message).toContain('invalid signature');
          });
      });
    });

    describe('실패 케이스 - 잘못된 토큰 타입', () => {
      it('Refresh Token으로 접근하면 401 에러를 반환한다', async () => {
        // Given: Refresh Token
        const payload = {
          sub: 'user-refresh',
          email: 'refresh@example.com',
          role: Role.USER,
          type: 'refresh', // ❌ Refresh 타입
        };
        const refreshToken = jwtService.sign(payload, {
          secret: configService.get('jwt.secret'), // 서명은 유효해야 함
          expiresIn: '7d',
        });

        // When & Then
        return request(app.getHttpServer())
          .get('/test/auth/protected')
          .set('Authorization', `Bearer ${refreshToken}`)
          .expect(401)
          .expect((res) => {
            expect(res.body.message).toContain('유효하지 않은 토큰 타입');
          });
      });
    });

    describe('실패 케이스 - 필수 필드 누락', () => {
      it('sub(userId)가 없으면 401 에러를 반환한다', async () => {
        const payload = {
          // sub 누락
          email: 'no-sub@example.com',
          role: Role.USER,
          type: 'access',
        };
        const invalidToken = jwtService.sign(payload, {
          secret: configService.get('jwt.secret'),
          expiresIn: '1d',
        });

        return request(app.getHttpServer())
          .get('/test/auth/protected')
          .set('Authorization', `Bearer ${invalidToken}`)
          .expect(401)
          .expect((res) => {
            expect(res.body.message).toContain('필수 정보가 누락');
          });
      });

      it('email이 없으면 401 에러를 반환한다', async () => {
        const payload = {
          sub: 'user-no-email',
          // email 누락
          role: Role.USER,
          type: 'access',
        };
        const invalidToken = jwtService.sign(payload, {
          secret: configService.get('jwt.secret'),
          expiresIn: '1d',
        });

        return request(app.getHttpServer())
          .get('/test/auth/protected')
          .set('Authorization', `Bearer ${invalidToken}`)
          .expect(401)
          .expect((res) => {
            expect(res.body.message).toContain('필수 정보가 누락');
          });
      });

      it('role이 없으면 401 에러를 반환한다', async () => {
        const payload = {
          sub: 'user-no-role',
          email: 'no-role@example.com',
          // role 누락
          type: 'access',
        };
        const invalidToken = jwtService.sign(payload, {
          secret: configService.get('jwt.secret'),
          expiresIn: '1d',
        });

        return request(app.getHttpServer())
          .get('/test/auth/protected')
          .set('Authorization', `Bearer ${invalidToken}`)
          .expect(401)
          .expect((res) => {
            expect(res.body.message).toContain('필수 정보가 누락');
          });
      });
    });
  });

  describe('JWT Refresh Token 인증', () => {
    describe('성공 케이스', () => {
      it('유효한 Refresh Token으로 refresh 엔드포인트에 접근한다', async () => {
        // Given: 유효한 Refresh Token
        const payload = {
          sub: 'user-refresh-123',
          email: 'refresh@example.com',
          role: Role.USER,
          type: 'refresh',
        };
        const refreshToken = jwtService.sign(payload, {
          secret: configService.get('jwt.refreshSecret'),
          expiresIn: '7d',
        });

        // When & Then
        return request(app.getHttpServer())
          .post('/test/auth/refresh')
          .set('Authorization', `Bearer ${refreshToken}`)
          .expect(201)
          .expect((res) => {
            expect(res.body.message).toBe('refresh endpoint');
            expect(res.body.user).toMatchObject({
              userId: 'user-refresh-123',
              email: 'refresh@example.com',
              role: Role.USER,
            });
          });
      });
    });

    describe('실패 케이스', () => {
      it('Access Token으로 접근하면 401 에러를 반환한다', async () => {
        // Given: Access Token
        const payload = {
          sub: 'user-access',
          email: 'access@example.com',
          role: Role.USER,
          type: 'access', // ❌ Access 타입
        };
        const accessToken = jwtService.sign(payload, {
          secret: configService.get('jwt.refreshSecret'), // 서명은 유효해야 함
          expiresIn: '1d',
        });

        // When & Then
        return request(app.getHttpServer())
          .post('/test/auth/refresh')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(401)
          .expect((res) => {
            expect(res.body.message).toContain('유효하지 않은 토큰 타입');
          });
      });

      it('만료된 Refresh Token이면 401 에러를 반환한다', async () => {
        const payload = {
          sub: 'user-expired-refresh',
          email: 'expired-refresh@example.com',
          role: Role.USER,
          type: 'refresh',
        };
        const expiredRefreshToken = jwtService.sign(payload, {
          secret: configService.get('jwt.refreshSecret'),
          expiresIn: '-1s',
        });

        return request(app.getHttpServer())
          .post('/test/auth/refresh')
          .set('Authorization', `Bearer ${expiredRefreshToken}`)
          .expect(401)
          .expect((res) => {
            expect(res.body.message).toContain('jwt expired');
          });
      });

      it('Refresh Token이 없으면 401 에러를 반환한다', () => {
        return request(app.getHttpServer())
          .post('/test/auth/refresh')
          .expect(401)
          .expect((res) => {
            expect(res.body.message).toContain(
              'No auth token',
            );
          });
      });
    });
  });
});
