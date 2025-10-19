import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductsRepository } from './repositories/products.repository';
import { PrismaModule } from '@/prisma/prisma.module';
import { JwtStrategy } from '@/common/auth/strategies/jwt.strategy';

/**
 * 상품 모듈
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
  controllers: [ProductsController],
  providers: [ProductsService, ProductsRepository, JwtStrategy],
  exports: [ProductsService, ProductsRepository],
})
export class ProductsModule {}
