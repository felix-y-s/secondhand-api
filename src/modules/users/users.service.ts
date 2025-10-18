import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { UsersRepository } from './repositories/users.repository';
import { CreateUserDto, UpdateUserDto, LoginUserDto } from './dto';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

/**
 * 사용자 관리 서비스
 */
@Injectable()
export class UsersService {
  private readonly saltRounds = 10;

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 회원가입
   * @param createUserDto 회원가입 정보
   * @returns 생성된 사용자 정보 (비밀번호 제외)
   * @throws ConflictException 이메일 또는 닉네임 중복 시
   */
  async create(createUserDto: CreateUserDto): Promise<Omit<User, 'password'>> {
    // 이메일 중복 체크
    const existingEmail = await this.usersRepository.findByEmail(
      createUserDto.email,
    );

    if (existingEmail) {
      throw new ConflictException('이미 사용 중인 이메일입니다');
    }

    // 닉네임 중복 체크
    const existingNickname = await this.usersRepository.findByNickname(
      createUserDto.nickname,
    );

    if (existingNickname) {
      throw new ConflictException('이미 사용 중인 닉네임입니다');
    }

    // 전화번호 중복 체크 (있는 경우에만)
    if (createUserDto.phoneNumber) {
      const existingPhone = await this.usersRepository.findByPhoneNumber(
        createUserDto.phoneNumber,
      );

      if (existingPhone) {
        throw new ConflictException('이미 사용 중인 전화번호입니다');
      }
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      this.saltRounds,
    );

    // 사용자 생성
    const user = await this.usersRepository.create({
      email: createUserDto.email,
      password: hashedPassword,
      nickname: createUserDto.nickname,
      ...(createUserDto.name && { name: createUserDto.name }),
      ...(createUserDto.phoneNumber && { phoneNumber: createUserDto.phoneNumber }),
    });

    // 비밀번호 제외하고 반환
    const { password, ...result } = user;
    return result;
  }

  /**
   * 로그인
   * @param loginUserDto 로그인 정보
   * @returns Access Token, Refresh Token, 사용자 정보
   * @throws UnauthorizedException 이메일 또는 비밀번호가 일치하지 않는 경우
   */
  async login(loginUserDto: LoginUserDto) {
    // 이메일로 사용자 찾기
    const user = await this.usersRepository.findByEmail(loginUserDto.email);

    if (!user) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 일치하지 않습니다');
    }

    // 비활성화된 계정 체크
    if (!user.isActive) {
      throw new UnauthorizedException('비활성화된 계정입니다');
    }

    // 비밀번호 검증
    const isPasswordValid = await bcrypt.compare(
      loginUserDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 일치하지 않습니다');
    }

    // 마지막 로그인 시간 업데이트
    await this.usersRepository.updateLastLogin(user.id);

    // JWT 토큰 생성
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // 비밀번호 제외하고 반환
    const { password, ...userWithoutPassword } = user;

    return {
      ...tokens,
      user: userWithoutPassword,
    };
  }

  /**
   * 사용자 ID로 조회
   * @param id 사용자 ID
   * @returns 사용자 정보 (비밀번호 제외)
   * @throws NotFoundException 사용자가 존재하지 않는 경우
   */
  async findOne(id: string): Promise<Omit<User, 'password'>> {
    const user = await this.usersRepository.findById(id);

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }

    const { password, ...result } = user;
    return result;
  }

  /**
   * 사용자 정보 수정
   * @param id 사용자 ID
   * @param updateUserDto 수정할 정보
   * @returns 수정된 사용자 정보 (비밀번호 제외)
   * @throws NotFoundException 사용자가 존재하지 않는 경우
   * @throws ConflictException 닉네임 또는 전화번호 중복 시
   */
  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<Omit<User, 'password'>> {
    // 사용자 존재 확인
    const user = await this.usersRepository.findById(id);

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }

    // 닉네임 중복 체크 (변경하는 경우에만)
    if (updateUserDto.nickname && updateUserDto.nickname !== user.nickname) {
      const existingNickname = await this.usersRepository.findByNickname(
        updateUserDto.nickname,
      );

      if (existingNickname) {
        throw new ConflictException('이미 사용 중인 닉네임입니다');
      }
    }

    // 전화번호 중복 체크 (변경하는 경우에만)
    if (
      updateUserDto.phoneNumber &&
      updateUserDto.phoneNumber !== user.phoneNumber
    ) {
      const existingPhone = await this.usersRepository.findByPhoneNumber(
        updateUserDto.phoneNumber,
      );

      if (existingPhone) {
        throw new ConflictException('이미 사용 중인 전화번호입니다');
      }
    }

    // 사용자 정보 수정
    const updatedUser = await this.usersRepository.update(id, updateUserDto);

    const { password, ...result } = updatedUser;
    return result;
  }

  /**
   * 사용자 삭제 (소프트 삭제 - isActive를 false로 변경)
   * @param id 사용자 ID
   * @throws NotFoundException 사용자가 존재하지 않는 경우
   */
  async remove(id: string): Promise<void> {
    const user = await this.usersRepository.findById(id);

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }

    // 소프트 삭제 (isActive를 false로 변경)
    await this.usersRepository.softDelete(id);
  }

  /**
   * JWT 토큰 생성 (Access Token + Refresh Token)
   * @param userId 사용자 ID
   * @param email 이메일
   * @param role 역할
   * @returns Access Token과 Refresh Token
   */
  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      // Access Token (15분)
      this.jwtService.signAsync(
        { ...payload, type: 'access' },
        {
          secret: this.configService.get<string>('JWT_SECRET'),
          expiresIn: '15m',
        },
      ),
      // Refresh Token (7일)
      this.jwtService.signAsync(
        { ...payload, type: 'refresh' },
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: '7d',
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refresh Token으로 새로운 Access Token 발급
   * @param userId 사용자 ID
   * @returns 새로운 Access Token
   * @throws NotFoundException 사용자가 존재하지 않는 경우
   */
  async refreshAccessToken(userId: string) {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('비활성화된 계정입니다');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return tokens;
  }
}
