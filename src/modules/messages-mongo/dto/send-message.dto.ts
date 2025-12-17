import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageType } from '../domain/enums/message-type.enum';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class sendMessageDto {
  @ApiProperty({
    description: '대화방 아이디',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty({ message: '대화방 아이디가 누락 되었습니다' })
  chatRoomId: string;
  
  @ApiProperty({
    description: '수신인 아이디',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty({ message: '수신인 아이디가 누락 되었습니다' })
  receiverId: string;

  @ApiProperty({ description: '대화 내용', example: '안녕하세요' })
  @IsString()
  @IsOptional()
  content: string;

  @ApiProperty({
    description: '대화 타입',
    example: MessageType.TEXT,
    enum: MessageType,
  })
  @IsEnum(MessageType, {
    message: `메시지 타입은 다음중 하나여야 합니다. ${Object.values(MessageType).join(', ')}`,
  })
  @IsOptional()
  messageType: MessageType = MessageType.TEXT;

  @ApiPropertyOptional({
    description: '파일 메시지 URL',
    example: 'https://example.com/image1.jpg.jpg',
    type: [String],
  })
  @IsString()
  @IsUrl()
  @IsOptional()
  fileUrl: string;

  @ApiPropertyOptional({
    description: '파일명',
    example: 'https://example.com/image1.jpg.jpg',
    type: [String],
  })
  @IsString()
  @IsOptional()
  fileName: string;
}