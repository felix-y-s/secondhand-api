import { ApiParam, ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class DeleteFavoriteDto {
  @ApiProperty({
    description: '찜 목록에서 삭제할 상품의 아이디',
  })
  @IsUUID(4, { message: 'productId는 uuid 타입이어야 합니다.' })
  productId: string;
}
