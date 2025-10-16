import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { LoggerModule } from './common/logger/logger.module';
import { MongodbModule } from './database/mongodb/mongodb.module';
import { RedisModule } from './database/redis/redis.module';
import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';
import { winstonConfig } from './config/logger.config';

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
    // Prisma 모듈 (PostgreSQL 연결)
    PrismaModule,
    // MongoDB 모듈 (비구조화 데이터)
    MongodbModule,
    // Redis 모듈 (캐싱 및 세션, 전역 사용 가능)
    RedisModule,
    // 커스텀 로거 모듈 (거래 로그 등)
    LoggerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
