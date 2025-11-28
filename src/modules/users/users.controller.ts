import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  ClassSerializerInterceptor,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  CreateUserDto,
  UpdateUserDto,
  LoginUserDto,
  UserResponseDto,
  AuthResponseDto,
} from './dto';
import { JwtAuthGuard } from '@/common/auth/guards/jwt-auth.guard';
import { JwtRefreshAuthGuard } from '@/common/auth/guards/jwt-refresh-auth.guard';
import { Public } from '@/common/auth/decorators/public.decorator';
import { CurrentUser } from '@/common/auth/decorators/current-user.decorator';
import type { JwtValidationResult } from '@/common/auth/interfaces/jwt-payload.interface';
import { ResponseDto } from '@/common/dto';
import { ApiGetResponses } from '@/common/decorators';
import { plainToInstance } from 'class-transformer';
import { Throttle } from '@nestjs/throttler';

/**
 * 사용자 관리 컨트롤러
 */
@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard) // 기본적으로 모든 엔드포인트에 JWT 인증 적용
@UseInterceptors(ClassSerializerInterceptor) // 응답 DTO 변환 (@Exclude, @Expose 적용)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * 회원가입
   */
  @Public() // JWT 인증 제외
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '회원가입',
    description: '새로운 사용자를 등록합니다',
  })
  @ApiCreatedResponse({
    description: '회원가입 성공',
    type: AuthResponseDto,
  })
  @ApiGetResponses()
  async register(
    @Body() createUserDto: CreateUserDto,
  ): Promise<ResponseDto<AuthResponseDto>> {
    const user = await this.usersService.create(createUserDto);

    // 회원가입 후 자동 로그인
    const loginResult = await this.usersService.login({
      email: createUserDto.email,
      password: createUserDto.password,
    });

    return {
      success: true,
      data: {
        ...loginResult,
        user: plainToInstance(UserResponseDto, loginResult.user),
      },
      message: '회원가입이 완료되었습니다',
    };
  }

  /**
   * 로그인
   */
  @Public() // JWT 인증 제외
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '로그인',
    description: '이메일과 비밀번호로 로그인합니다',
  })
  @ApiOkResponse({
    description: '로그인 성공',
    type: AuthResponseDto,
  })
  @ApiGetResponses()
  async login(
    @Body() loginUserDto: LoginUserDto,
  ): Promise<ResponseDto<AuthResponseDto>> {
    const result = await this.usersService.login(loginUserDto);

    return {
      success: true,
      data: {
        ...result,
        user: plainToInstance(UserResponseDto, result.user),
      },
      message: '로그인에 성공했습니다',
    };
  }

  /**
   * Access Token 재발급
   */
  @Public() // JWT 인증 제외 (Refresh Token Guard 사용)
  @Post('refresh')
  @UseGuards(JwtRefreshAuthGuard) // Refresh Token 검증
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Access Token 재발급',
    description: 'Refresh Token을 사용하여 새로운 Access Token을 발급받습니다',
  })
  @ApiBearerAuth('refresh-token')
  @ApiOkResponse({
    description: 'Token 재발급 성공',
    type: AuthResponseDto,
  })
  @ApiGetResponses()
  async refresh(
    @CurrentUser() user: JwtValidationResult,
  ): Promise<ResponseDto<{ accessToken: string; refreshToken: string }>> {
    const tokens = await this.usersService.refreshAccessToken(user.userId);

    return {
      success: true,
      data: tokens,
      message: 'Token이 재발급되었습니다',
    };
  }

  /**
   * 내 정보 조회
   */
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '내 정보 조회',
    description: '로그인한 사용자의 정보를 조회합니다',
  })
  @ApiBearerAuth('access-token')
  @ApiOkResponse({
    description: '내 정보 조회 성공',
    type: UserResponseDto,
  })
  @ApiGetResponses()
  async getMe(
    @CurrentUser() user: JwtValidationResult,
  ): Promise<ResponseDto<UserResponseDto>> {
    const userData = await this.usersService.findOne(user.userId);

    return {
      success: true,
      data: plainToInstance(UserResponseDto, userData),
    };
  }

  /**
   * 내 정보 수정
   */
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '내 정보 수정',
    description: '로그인한 사용자의 정보를 수정합니다',
  })
  @ApiBearerAuth('access-token')
  @ApiOkResponse({
    description: '내 정보 수정 성공',
    type: UserResponseDto,
  })
  @ApiGetResponses()
  async updateMe(
    @CurrentUser() user: JwtValidationResult,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<ResponseDto<UserResponseDto>> {
    const updatedUser = await this.usersService.update(
      user.userId,
      updateUserDto,
    );

    return {
      success: true,
      data: plainToInstance(UserResponseDto, updatedUser),
      message: '정보가 수정되었습니다',
    };
  }

  /**
   * 회원 탈퇴
   */
  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '회원 탈퇴',
    description: '로그인한 사용자의 계정을 비활성화합니다',
  })
  @ApiBearerAuth('access-token')
  @ApiOkResponse({
    description: '회원 탈퇴 성공',
  })
  @ApiGetResponses()
  async deleteMe(
    @CurrentUser() user: JwtValidationResult,
  ): Promise<ResponseDto<null>> {
    await this.usersService.remove(user.userId);

    return {
      success: true,
      data: null,
      message: '회원 탈퇴가 완료되었습니다',
    };
  }
}
