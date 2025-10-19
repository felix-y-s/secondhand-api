import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

/**
 * 주문 생성 DTO
 */
export class CreateOrderDto {
  @ApiProperty({
    description: '상품 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty({ message: '상품 ID는 필수입니다' })
  @IsString({ message: '상품 ID는 문자열이어야 합니다' })
  productId: string;

  @ApiProperty({
    description: '총 금액',
    example: 50000,
    minimum: 0,
  })
  @IsNotEmpty({ message: '총 금액은 필수입니다' })
  @IsInt({ message: '총 금액은 정수여야 합니다' })
  @Min(0, { message: '총 금액은 0 이상이어야 합니다' })
  totalAmount: number;

  @ApiPropertyOptional({
    description: '배송비',
    example: 3000,
    default: 0,
  })
  @IsOptional()
  @IsInt({ message: '배송비는 정수여야 합니다' })
  @Min(0, { message: '배송비는 0 이상이어야 합니다' })
  shippingFee?: number;

  @ApiPropertyOptional({
    description: '수령인 이름',
    example: '홍길동',
  })
  @IsOptional()
  @IsString({ message: '수령인 이름은 문자열이어야 합니다' })
  recipientName?: string;

  @ApiPropertyOptional({
    description: '수령인 연락처',
    example: '010-1234-5678',
  })
  @IsOptional()
  @IsString({ message: '수령인 연락처는 문자열이어야 합니다' })
  recipientPhone?: string;

  @ApiPropertyOptional({
    description: '배송 주소',
    example: '서울특별시 강남구 테헤란로 123',
  })
  @IsOptional()
  @IsString({ message: '배송 주소는 문자열이어야 합니다' })
  shippingAddress?: string;

  @ApiPropertyOptional({
    description: '우편번호',
    example: '06234',
  })
  @IsOptional()
  @IsString({ message: '우편번호는 문자열이어야 합니다' })
  shippingPostcode?: string;

  @ApiPropertyOptional({
    description: '결제 방법',
    enum: PaymentMethod,
    example: PaymentMethod.CARD,
  })
  @IsOptional()
  @IsEnum(PaymentMethod, {
    message: `결제 방법은 다음 중 하나여야 합니다: ${Object.values(PaymentMethod).join(', ')}`,
  })
  paymentMethod?: PaymentMethod;
}
