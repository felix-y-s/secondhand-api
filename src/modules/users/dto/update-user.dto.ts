import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
  IsUrl,
} from 'class-validator';

/**
 * 사용자 정보 수정 DTO
 */
export class UpdateUserDto {
  @ApiProperty({
    description: '닉네임 (2-20자)',
    example: '새로운닉네임',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MinLength(2, { message: '닉네임은 최소 2자 이상이어야 합니다' })
  @MaxLength(20, { message: '닉네임은 최대 20자 이하여야 합니다' })
  nickname?: string;

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

  @ApiProperty({
    description: '프로필 이미지 URL',
    example: 'https://example.com/profile.jpg',
    required: false,
  })
  @IsString()
  @IsOptional()
  @IsUrl({}, { message: '유효한 URL을 입력해주세요' })
  profileImage?: string;

  @ApiProperty({
    description: '자기소개 (최대 500자)',
    example: '안녕하세요! 중고거래 즐겨하는 사용자입니다.',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500, { message: '자기소개는 최대 500자 이하여야 합니다' })
  bio?: string;
}
