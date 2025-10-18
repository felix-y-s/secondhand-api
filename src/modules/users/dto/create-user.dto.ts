import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
} from 'class-validator';

/**
 * 회원가입 요청 DTO
 */
export class CreateUserDto {
  @ApiProperty({
    description: '이메일 주소',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: '유효한 이메일 주소를 입력해주세요' })
  @IsNotEmpty({ message: '이메일은 필수입니다' })
  email: string;

  @ApiProperty({
    description: '비밀번호 (8-20자, 영문/숫자/특수문자 포함)',
    example: 'Password123!',
    minLength: 8,
    maxLength: 20,
  })
  @IsString()
  @IsNotEmpty({ message: '비밀번호는 필수입니다' })
  @MinLength(8, { message: '비밀번호는 최소 8자 이상이어야 합니다' })
  @MaxLength(20, { message: '비밀번호는 최대 20자 이하여야 합니다' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/, {
    message: '비밀번호는 영문, 숫자, 특수문자를 포함해야 합니다',
  })
  password: string;

  @ApiProperty({
    description: '닉네임 (2-20자)',
    example: '중고마켓왕',
    minLength: 2,
    maxLength: 20,
  })
  @IsString()
  @IsNotEmpty({ message: '닉네임은 필수입니다' })
  @MinLength(2, { message: '닉네임은 최소 2자 이상이어야 합니다' })
  @MaxLength(20, { message: '닉네임은 최대 20자 이하여야 합니다' })
  nickname: string;

  @ApiProperty({
    description: '이름',
    example: '홍길동',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: '전화번호 (하이픈 없이)',
    example: '01012345678',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Matches(/^01[0-9]{8,9}$/, {
    message: '유효한 전화번호를 입력해주세요 (예: 01012345678)',
  })
  phoneNumber?: string;
}
