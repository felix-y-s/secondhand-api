import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AddFavoriteDto {
  @ApiProperty({ description: '상품 ID' })
  @IsString({ message(validationArguments) {
    return `${validationArguments.value} must be a string.`
  },})
  productId: string;
}