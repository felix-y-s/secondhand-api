import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { UsersRepository } from './repositories/users.repository';
import { JwtStrategy } from '@/common/auth/strategies/jwt.strategy';
import { JwtRefreshStrategy } from '@/common/auth/strategies/jwt-refresh.strategy';
import { OrdersModule } from '../orders/orders.module';

/**
 * 사용자 관리 모듈
 */
@Module({
  imports: [
    OrdersModule,
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // JWT 모듈 설정
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-secret-key',
        signOptions: {
          expiresIn: '15m', // Access Token 유효기간
        },
      }),
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, JwtStrategy, JwtRefreshStrategy],
  exports: [UsersService], // 다른 모듈에서 UsersService 사용 가능
})
export class UsersModule {}
