import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { ReviewsRepository } from './repositories/reviews.repository';
import { PrismaModule } from '@/prisma/prisma.module';
import { JwtStrategy } from '@/common/auth/strategies/jwt.strategy';
import { RolesGuard } from '@/common/auth/guards/roles.guard';
import { OrdersModule } from '../orders/orders.module';

/**
 * Reviews Module
 * 리뷰 관련 기능 모듈
 */
@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}), // 설정은 JwtStrategy에서 처리
    OrdersModule,
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewsRepository, JwtStrategy, RolesGuard],
  exports: [ReviewsService, ReviewsRepository],
})
export class ReviewsModule {}
