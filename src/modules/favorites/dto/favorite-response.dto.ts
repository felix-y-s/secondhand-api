import { PaginatedResponseDto } from '@/common/dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsUUID } from 'class-validator';

// 단일 찜 응답
export class FavoriteItemDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID(4, { message: '유효하지 않은 UUID입니다' })
  userId: string;
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID(4, { message: '유효하지 않은 UUID입니다' })
  productId: string;
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID(4, { message: '유효하지 않은 UUID입니다' })
  id: string;
  @ApiProperty({ example: '2025-11-29T11:44:39.000Z' })
  createdAt: Date;
}

// 목록 응답
export class FavoritesListResponseDto extends PaginatedResponseDto<FavoriteItemDto> {
  @ApiProperty({ type: [FavoriteItemDto] })
  items: FavoriteItemDto[];
}