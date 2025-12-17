import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateChatRoomDto {
  @ApiProperty({ description: '수신인 ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  receiverId: string;

  @ApiProperty({ description: '상품 ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  productId: string;
}