import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './repositories/orders.repository';
import { ProductsRepository } from '../products/repositories/products.repository';
import { PrismaModule } from '@/prisma/prisma.module';
import { RolesGuard } from '@/modules/auth';
import { AuthModule } from '../auth/auth.module';

/**
 * Orders Module
 * 주문 관련 기능 모듈
 */
@Module({
  imports: [
    PrismaModule,
    AuthModule,
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrdersRepository,
    ProductsRepository,
    RolesGuard,
  ],
  exports: [OrdersService, OrdersRepository],
})
export class OrdersModule {}
