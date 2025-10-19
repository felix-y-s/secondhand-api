import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { CategoriesRepository } from './repositories/categories.repository';
import { PrismaModule } from '@/prisma/prisma.module';
import { JwtStrategy } from '@/common/auth/strategies/jwt.strategy';
import { RolesGuard } from '@/common/auth/guards/roles.guard';

/**
 * 카테고리 관리 모듈
 * - 계층 구조 지원
 * - Repository 패턴
 * - JWT 인증 및 RBAC 적용
 */
@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-secret-key',
        signOptions: {
          expiresIn: '15m',
        },
      }),
    }),
  ],
  controllers: [CategoriesController],
  providers: [CategoriesService, CategoriesRepository, JwtStrategy, RolesGuard],
  exports: [CategoriesService, CategoriesRepository],
})
export class CategoriesModule {}
