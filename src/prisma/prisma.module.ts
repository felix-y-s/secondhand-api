import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Prisma 모듈
 * 애플리케이션 전역에서 사용 가능한 Prisma 서비스를 제공
 * @Global 데코레이터를 사용하여 다른 모듈에서 import 없이 사용 가능
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
