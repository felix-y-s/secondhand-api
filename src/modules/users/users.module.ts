import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { UsersRepository } from './repositories/users.repository';
import { OrdersModule } from '../orders/orders.module';
import { AuthModule } from '../auth/auth.module';

/**
 * 사용자 관리 모듈
 */
@Module({
  imports: [OrdersModule, PrismaModule, AuthModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService], // 다른 모듈에서 UsersService 사용 가능
})
export class UsersModule {}
