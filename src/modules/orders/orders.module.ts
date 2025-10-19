import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './repositories/orders.repository';
import { ProductsRepository } from '../products/repositories/products.repository';
import { PrismaModule } from '@/prisma/prisma.module';
import { JwtStrategy } from '@/common/auth/strategies/jwt.strategy';
import { RolesGuard } from '@/common/auth/guards/roles.guard';

/**
 * Orders Module
 * 주문 관련 기능 모듈
 */
@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}), // 설정은 JwtStrategy에서 처리
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrdersRepository,
    ProductsRepository,
    JwtStrategy,
    RolesGuard,
  ],
  exports: [OrdersService, OrdersRepository],
})
export class OrdersModule {}
