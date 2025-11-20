import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { BlockWebSocketMiddleware } from './common/middleware';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // Winston이 로그를 버퍼링할 수 있도록 설정
  });

  // Winston 로거를 애플리케이션 로거로 설정
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // ==================== 전역 에러 처리 및 응답 변환 ====================

  /**
   * Global Exception Filter: 모든 예외를 일관된 형식으로 변환
   *
   * - HttpException: NestJS 표준 예외 처리
   * - Prisma 에러: P2002 (중복), P2025 (NotFound), P2003 (FK 위반) 등 매핑
   * - 일반 에러: 500 Internal Server Error로 처리
   * - 응답 형식: {success: false, statusCode, message, errors?, timestamp, path, method}
   */
  app.useGlobalFilters(new HttpExceptionFilter());

  /**
   * Global Interceptors: HTTP 요청/응답 처리
   *
   * 1. TransformInterceptor: 성공 응답을 일관된 형식으로 변환
   *    - 응답 형식: {success: true, statusCode, data?, timestamp}
   *    - 이미 변환된 응답(success 필드 존재)은 재변환 방지
   *
   * 2. LoggingInterceptor: HTTP 요청/응답 로깅
   *    - Winston 로거 사용
   *    - 요청 메서드, URL, 응답 시간, 상태 코드 기록
   */
  app.useGlobalInterceptors(
    new TransformInterceptor(),
    new LoggingInterceptor(app.get(WINSTON_MODULE_NEST_PROVIDER)),
  );

  // ==================== 보안 미들웨어 설정 ====================

  /**
   * Helmet: HTTP 헤더 보안 강화
   *
   * - Content-Security-Policy: XSS 공격 방어
   * - X-Content-Type-Options: MIME 타입 스니핑 방지
   * - X-Frame-Options: 클릭재킹 방어
   * - Strict-Transport-Security: HTTPS 강제
   * - X-DNS-Prefetch-Control: DNS 프리페칭 제어
   */
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"], // 기본적으로 동일 출처만 허용
          styleSrc: ["'self'", "'unsafe-inline'"], // 인라인 스타일 허용 (Swagger용)
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // 인라인 스크립트 허용 (Swagger용)
          imgSrc: ["'self'", 'data:', 'https:'], // 이미지 출처 제한
        },
      },
      crossOriginEmbedderPolicy: false, // Swagger iframe을 위해 비활성화
    }),
  );

  /**
   * CORS 설정: 교차 출처 리소스 공유
   *
   * - origin: 허용할 출처 목록 (환경변수 또는 기본값)
   * - credentials: 쿠키 및 인증 정보 포함 허용
   * - methods: 허용할 HTTP 메서드
   * - allowedHeaders: 허용할 요청 헤더
   * - exposedHeaders: 클라이언트에 노출할 응답 헤더
   * - maxAge: Preflight 요청 캐시 시간 (초)
   */
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
    maxAge: 3600, // 1시간
  });

  /**
   * Compression: 응답 본문 압축 (gzip)
   *
   * - 네트워크 대역폭 절약
   * - 응답 속도 향상 (특히 JSON/텍스트)
   * - 1KB 이상 응답만 압축
   * - x-no-compression 헤더로 압축 비활성화 가능
   */
  app.use(
    compression({
      filter: (req, res) => {
        // 압축 제외 조건
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
      threshold: 1024, // 1KB 이상만 압축
    }),
  );

  /**
   * WebSocket 경로 차단: 구성되지 않은 Socket.IO 연결 차단
   *
   * - /socket.io/ 경로로의 모든 요청을 사전 차단
   * - 보안: 불필요한 WebSocket 연결 시도 방지
   * - 로그 노이즈 감소
   * - 향후 WebSocket 구현 시 이 미들웨어 제거 필요
   */
  app.use(new BlockWebSocketMiddleware().use);

  /**
   * Global Validation Pipe: 요청 데이터 자동 검증
   *
   * - whitelist: DTO에 정의되지 않은 속성 자동 제거
   * - forbidNonWhitelisted: 정의되지 않은 속성 있으면 에러 발생
   * - transform: 요청 데이터를 DTO 타입으로 자동 변환
   * - enableImplicitConversion: 문자열 -> 숫자, 불린 등 자동 변환
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  /**
   * Global Prefix: 모든 API 경로에 접두사 추가
   *
   * - /api/v1/** 형태로 API 버저닝
   * - health, api-docs 등 특수 경로는 제외
   * - 추후 v2, v3 등으로 확장 가능
   */
  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'api-docs'], // 헬스체크와 API 문서는 제외
  });

  /**
   * Swagger API 문서 설정
   *
   * - JWT Bearer 인증 지원
   * - API 태그별 분류 (users, products, orders, payments, chat, notifications, health)
   * - Rate Limiting 정보 포함
   * - 환경별 서버 URL 설정
   */
  const config = new DocumentBuilder()
    .setTitle('중고거래 플랫폼 API')
    .setDescription(
      '중고거래 플랫폼 백엔드 API 문서\n\n' +
        '**Rate Limiting 정책**:\n' +
        '- Short (민감한 API): 1분당 10회\n' +
        '- Medium (CRUD API): 1분당 30회\n' +
        '- Long (읽기 API): 1분당 100회\n\n' +
        '**인증**:\n' +
        '- JWT Bearer Token 방식\n' +
        '- Access Token 유효기간: 15분\n' +
        '- Refresh Token 유효기간: 7일\n\n' +
        '**API 버전**: v1\n' +
        '**Base URL**: /api/v1',
    )
    .setVersion('1.0')
    .setContact(
      'Backend Team',
      'https://github.com/yourusername/secondhand-api',
      'backend@example.com',
    )
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addServer(process.env.API_URL || 'http://localhost:3000', '개발 서버')
    .addServer('https://staging.api.example.com', '스테이징 서버')
    .addServer('https://api.example.com', '프로덕션 서버')
    .addTag('health', '헬스체크 및 모니터링')
    .addTag('auth', '인증 및 권한')
    .addTag('users', '사용자 관리')
    .addTag('products', '상품 관리')
    .addTag('orders', '주문 관리')
    .addTag('payments', '결제 관리')
    .addTag('chat', '채팅 시스템')
    .addTag('notifications', '알림 서비스')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'JWT 액세스 토큰을 입력하세요 (Bearer 제외)',
        in: 'header',
      },
      'access-token',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT Refresh',
        description: 'JWT 리프레시 토큰을 입력하세요 (Bearer 제외)',
        in: 'header',
      },
      'refresh-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // 새로고침 시 인증 정보 유지
      tagsSorter: 'alpha', // 태그 알파벳 순 정렬
      operationsSorter: 'alpha', // API 엔드포인트 알파벳 순 정렬
    },
  });

  await app.listen(process.env.PORT ?? 3000);

  console.log(
    `Application is running on: http://localhost:${process.env.PORT ?? 3000}`,
  );
  console.log(
    `Swagger API Docs: http://localhost:${process.env.PORT ?? 3000}/api-docs`,
  );
}
bootstrap();
