import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateChatRoomDto {
  @ApiProperty({ description: '상품 ID' })
  @IsString()
  productId: string;
}