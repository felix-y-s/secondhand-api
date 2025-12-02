import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { ReviewsRepository } from './repositories/reviews.repository';
import { PrismaModule } from '@/prisma/prisma.module';
import { RolesGuard } from '@/modules/auth';
import { OrdersModule } from '../orders/orders.module';
import { AuthModule } from '../auth/auth.module';

/**
 * Reviews Module
 * 리뷰 관련 기능 모듈
 */
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    OrdersModule,
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewsRepository, RolesGuard],
  exports: [ReviewsService, ReviewsRepository],
})
export class ReviewsModule {}
