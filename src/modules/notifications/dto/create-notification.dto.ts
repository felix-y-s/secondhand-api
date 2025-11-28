import { ApiProperty } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * 알림 생성 DTO
 */
export class CreateNotificationDto {
  @ApiProperty({
    description: '수신자 ID',
    example: 'user-123',
  })
  @IsNotEmpty({ message: '수신자 ID는 필수입니다' })
  @IsString()
  userId: string;

  @ApiProperty({
    description: '알림 타입',
    enum: NotificationType,
    example: NotificationType.NEW_MESSAGE,
  })
  @IsEnum(NotificationType, { message: '유효한 알림 타입을 선택해주세요' })
  type: NotificationType;

  @ApiProperty({
    description: '알림 제목',
    example: '새 메시지가 도착했습니다',
  })
  @IsString()
  @IsNotEmpty({ message: '제목은 필수입니다' })
  title: string;

  @ApiProperty({
    description: '알림 내용',
    example: '김철수님이 메시지를 보냈습니다',
  })
  @IsString()
  @IsNotEmpty({ message: '내용은 필수입니다' })
  message: string;

  @ApiProperty({
    description: '관련 엔티티 ID (상품, 주문, 메시지 등)',
    example: 'msg-abc123',
    required: false,
  })
  @IsOptional()
  @IsString()
  relatedId?: string;

  @ApiProperty({
    description: '관련 엔티티 타입 (Product, Order, Message 등)',
    example: 'Message',
    required: false,
  })
  @IsOptional()
  @IsString()
  relatedType?: string;
}
