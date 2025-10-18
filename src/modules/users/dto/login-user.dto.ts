import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty } from 'class-validator';

/**
 * 로그인 요청 DTO
 */
export class LoginUserDto {
  @ApiProperty({
    description: '이메일 주소',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: '유효한 이메일 주소를 입력해주세요' })
  @IsNotEmpty({ message: '이메일은 필수입니다' })
  email: string;

  @ApiProperty({
    description: '비밀번호',
    example: 'Password123!',
  })
  @IsString()
  @IsNotEmpty({ message: '비밀번호는 필수입니다' })
  password: string;
}
