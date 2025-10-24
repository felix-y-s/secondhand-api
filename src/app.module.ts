import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { LoggerModule } from './common/logger/logger.module';
import { MongodbModule } from './database/mongodb/mongodb.module';
import { RedisModule } from './database/redis/redis.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { EventsModule } from './events/events.module';
import { HealthModule } from './health/health.module';
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';
import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';
import { winstonConfig } from './config/logger.config';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ReviewsModule } from './modules/reviews/reviews.module';

@Module({
  imports: [
    // 환경 변수 설정 (전역 사용 가능)
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    // Winston 로거 설정 (전역 사용 가능)
    WinstonModule.forRoot(winstonConfig),
    // 커스텀 로거 모듈 (거래 로그 등)
    LoggerModule,
    // Prisma 모듈 (PostgreSQL 연결)
    PrismaModule,
    // MongoDB 모듈 (비구조화 데이터)
    MongodbModule,
    // Redis 모듈 (캐싱 및 세션, 전역 사용 가능)
    RedisModule.forRoot(),
    // RabbitMQ 모듈 (이벤트 메시지 큐, 전역 사용 가능) - EventsModule보다 먼저 로드
    RabbitMQModule,
    // Events 모듈 (이벤트 발행/구독, 전역 사용 가능) - RabbitMQModule 이후 로드
    EventsModule,
    // Health 모듈 (헬스체크 엔드포인트)
    HealthModule,
    // Users 모듈 (사용자 관리)
    UsersModule,
    // Products 모듈 (상품 관리)
    ProductsModule,
    // Categories 모듈 (카테고리 관리)
    CategoriesModule,
    // Orders 모듈 (주문 관리)
    OrdersModule,
    // Throttler 모듈 (Rate Limiting, 전역 사용 가능)
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: () => [
        {
          name: 'short', // 짧은 시간 제한 (예: 로그인, 민감한 API)
          ttl: 60000, // 1분 (밀리초)
          limit: 10, // 1분당 10회
        },
        {
          name: 'medium', // 중간 시간 제한 (일반 API)
          ttl: 60000, // 1분
          limit: 30, // 1분당 30회
        },
        {
          name: 'long', // 긴 시간 제한 (읽기 전용 API)
          ttl: 60000, // 1분
          limit: 100, // 1분당 100회
        },
      ],
    }),
    ReviewsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Rate Limiting 전역 가드 (@SkipThrottle 데코레이터 지원)
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule {}
