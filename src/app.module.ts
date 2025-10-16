import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { LoggerModule } from './common/logger/logger.module';
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
    // Prisma 모듈 (데이터베이스 연결)
    PrismaModule,
    // 커스텀 로거 모듈 (거래 로그 등)
    LoggerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
