import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Exclude, Expose } from 'class-transformer';

/**
 * 사용자 정보 응답 DTO (비밀번호 제외)
 *
 * @Exclude(): 클래스 레벨에서 모든 속성을 기본적으로 제외
 * @Expose(): 응답에 포함할 속성만 명시적으로 노출
 *
 * 이 패턴을 사용하면 민감한 정보(password 등)가 실수로 노출되는 것을 방지할 수 있습니다.
 */
@Exclude()
export class UserResponseDto {
  @ApiProperty({
    description: '사용자 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @Expose() // 응답에 포함
  id: string;

  @ApiProperty({
    description: '이메일 주소',
    example: 'user@example.com',
  })
  @Expose() // 응답에 포함
  email: string;

  @ApiProperty({
    description: '닉네임',
    example: '중고마켓왕',
  })
  @Expose() // 응답에 포함
  nickname: string;

  @ApiProperty({
    description: '이름',
    example: '홍길동',
    nullable: true,
  })
  @Expose() // 응답에 포함
  name: string | null;

  @ApiProperty({
    description: '전화번호',
    example: '01012345678',
    nullable: true,
  })
  @Expose() // 응답에 포함
  phoneNumber: string | null;

  @ApiProperty({
    description: '프로필 이미지 URL',
    example: 'https://example.com/profile.jpg',
    nullable: true,
  })
  @Expose() // 응답에 포함
  profileImage: string | null;

  @ApiProperty({
    description: '자기소개',
    example: '안녕하세요!',
    nullable: true,
  })
  @Expose() // 응답에 포함
  bio: string | null;

  @ApiProperty({
    description: '역할',
    enum: Role,
    example: Role.USER,
  })
  @Expose() // 응답에 포함
  role: Role;

  @ApiProperty({
    description: '이메일 인증 여부',
    example: true,
  })
  @Expose() // 응답에 포함
  emailVerified: boolean;

  @ApiProperty({
    description: '전화번호 인증 여부',
    example: false,
  })
  @Expose() // 응답에 포함
  phoneVerified: boolean;

  @ApiProperty({
    description: '활성화 여부',
    example: true,
  })
  @Expose() // 응답에 포함
  isActive: boolean;

  @ApiProperty({
    description: '평점',
    example: 4.5,
  })
  @Expose() // 응답에 포함
  rating: number;

  @ApiProperty({
    description: '평점 수',
    example: 10,
  })
  @Expose() // 응답에 포함
  ratingCount: number;

  @ApiProperty({
    description: '생성일시',
    example: '2024-01-01T00:00:00.000Z',
  })
  @Expose() // 응답에 포함
  createdAt: Date;

  @ApiProperty({
    description: '수정일시',
    example: '2024-01-01T00:00:00.000Z',
  })
  @Expose() // 응답에 포함
  updatedAt: Date;

  @ApiProperty({
    description: '마지막 로그인 일시',
    example: '2024-01-01T00:00:00.000Z',
    nullable: true,
  })
  @Expose() // 응답에 포함
  lastLoginAt: Date | null;
}
