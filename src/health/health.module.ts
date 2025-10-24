import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { MongodbModule } from '@/database/mongodb/mongodb.module';

/**
 * 헬스체크 모듈
 *
 * 시스템 및 연동 서비스 상태 확인 기능 제공
 */
@Module({
  imports: [PrismaModule, MongodbModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
