import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, PaymentMethod } from '@prisma/client';

/**
 * 주문 정보 수정 DTO
 */
export class UpdateOrderDto {
  @ApiPropertyOptional({
    description: '주문 상태',
    enum: OrderStatus,
    example: OrderStatus.PAID,
  })
  @IsOptional()
  @IsEnum(OrderStatus, {
    message: `주문 상태는 다음 중 하나여야 합니다: ${Object.values(OrderStatus).join(', ')}`,
  })
  status?: OrderStatus;

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
    description: '송장 번호',
    example: '1234567890',
  })
  @IsOptional()
  @IsString({ message: '송장 번호는 문자열이어야 합니다' })
  trackingNumber?: string;

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

  @ApiPropertyOptional({
    description: '결제 ID (PG사 거래 ID)',
    example: 'imp_123456789',
  })
  @IsOptional()
  @IsString({ message: '결제 ID는 문자열이어야 합니다' })
  paymentId?: string;
}
