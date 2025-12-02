import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { CategoriesRepository } from './repositories/categories.repository';
import { PrismaModule } from '@/prisma/prisma.module';
import { RolesGuard } from '@/modules/auth';
import { AuthModule } from '../auth/auth.module';

/**
 * 카테고리 관리 모듈
 * - 계층 구조 지원
 * - Repository 패턴
 * - JWT 인증 및 RBAC 적용
 */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CategoriesController],
  providers: [CategoriesService, CategoriesRepository, RolesGuard],
  exports: [CategoriesService, CategoriesRepository],
})
export class CategoriesModule {}
