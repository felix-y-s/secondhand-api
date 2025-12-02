import { JwtRefreshStrategy, JwtStrategy } from '@/modules/auth';
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: configService.get('jwt.expiresIn'), // Access Token 유효기간
        },
      }),
    }),
  ],
  providers: [JwtStrategy, JwtRefreshStrategy, JwtService],
  exports: [JwtStrategy, JwtRefreshStrategy, JwtService],
})
export class AuthModule {}