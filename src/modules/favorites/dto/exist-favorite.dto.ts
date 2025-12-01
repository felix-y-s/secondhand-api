import { IsUUID } from 'class-validator';

export class existFavoriteDto {
  @IsUUID(4, { message: 'productId는 uuid 타입이어야 합니다.'})
  productId: string;
}