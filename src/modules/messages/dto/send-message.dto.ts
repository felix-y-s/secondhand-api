import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ description: '채팅방 ID' })
  @IsString()
  chatRoomId: string;

  @ApiProperty({ description: '메시지 내용' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ description: '메시지 타입' })
  @IsOptional()
  @IsEnum(MessageType)
  messageType?: MessageType;

  @ApiPropertyOptional({ description: '파일 URL'})
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiPropertyOptional({description: '파일명'})
  @IsOptional()
  @IsString()
  fileName?: string;
}