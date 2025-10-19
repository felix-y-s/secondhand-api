import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  MinLength,
  MaxLength,
  Matches,
  Min,
} from 'class-validator';

/**
 * 카테고리 생성 DTO
 */
export class CreateCategoryDto {
  @ApiProperty({
    description: '카테고리 이름',
    example: '전자기기',
    minLength: 1,
    maxLength: 50,
  })
  @IsString()
  @MinLength(1, { message: '카테고리 이름은 최소 1자 이상이어야 합니다' })
  @MaxLength(50, { message: '카테고리 이름은 최대 50자까지 가능합니다' })
  name: string;

  @ApiProperty({
    description: 'URL 친화적 식별자 (영문 소문자, 숫자, 하이픈만 허용)',
    example: 'electronics',
    pattern: '^[a-z0-9-]+$',
  })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug는 영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다',
  })
  slug: string;

  @ApiPropertyOptional({
    description: '카테고리 아이콘 URL',
    example: 'https://cdn.example.com/icons/electronics.svg',
  })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({
    description: '부모 카테고리 ID (계층 구조)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({
    description: '표시 순서 (낮을수록 먼저 표시)',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt({ message: '순서는 정수여야 합니다' })
  @Min(0, { message: '순서는 0 이상이어야 합니다' })
  order?: number;

  @ApiPropertyOptional({
    description: '활성화 상태',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
