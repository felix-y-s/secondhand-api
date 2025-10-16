import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // Winston이 로그를 버퍼링할 수 있도록 설정
  });

  // Winston 로거를 애플리케이션 로거로 설정
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // HTTP 요청 로깅 인터셉터 등록
  app.useGlobalInterceptors(new LoggingInterceptor(app.get(WINSTON_MODULE_NEST_PROVIDER)));

  // Swagger 설정
  const config = new DocumentBuilder()
    .setTitle('중고거래 플랫폼 API')
    .setDescription('중고거래 플랫폼 백엔드 API 문서')
    .setVersion('1.0')
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
        description: 'JWT 토큰을 입력하세요',
        in: 'header',
      },
      'access-token',
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

  console.log(`Application is running on: http://localhost:${process.env.PORT ?? 3000}`);
  console.log(`Swagger API Docs: http://localhost:${process.env.PORT ?? 3000}/api-docs`);
}
bootstrap();
