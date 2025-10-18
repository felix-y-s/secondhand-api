import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '@/prisma/prisma.module';

/**
 * 사용자 관리 모듈
 */
import { UsersRepository } from './repositories/users.repository';

@Module({
  imports: [
    PrismaModule,
    // JWT 모듈 설정
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '15m', // Access Token 유효기간
        },
      }),
    }),
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    UsersRepository, // Repository 추가
  ],
  exports: [UsersService], // 다른 모듈에서 UsersService 사용 가능
})
export class UsersModule {}
