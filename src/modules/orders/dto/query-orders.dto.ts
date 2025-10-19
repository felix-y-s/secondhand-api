import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { OrderStatus } from '@prisma/client';

/**
 * 주문 목록 조회 DTO
 */
export class QueryOrdersDto {
  @ApiPropertyOptional({
    description: '페이지 번호 (1부터 시작)',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '페이지 번호는 정수여야 합니다' })
  @Min(1, { message: '페이지 번호는 1 이상이어야 합니다' })
  page?: number = 1;

  @ApiPropertyOptional({
    description: '페이지당 항목 수',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '페이지 크기는 정수여야 합니다' })
  @Min(1, { message: '페이지 크기는 1 이상이어야 합니다' })
  limit?: number = 20;

  @ApiPropertyOptional({
    description: '주문 상태 필터',
    enum: OrderStatus,
    example: OrderStatus.PAID,
  })
  @IsOptional()
  @IsEnum(OrderStatus, {
    message: `주문 상태는 다음 중 하나여야 합니다: ${Object.values(OrderStatus).join(', ')}`,
  })
  status?: OrderStatus;
}
