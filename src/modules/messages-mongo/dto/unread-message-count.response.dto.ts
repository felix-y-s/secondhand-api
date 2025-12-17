import { ApiProperty } from '@nestjs/swagger';

export class UnreadMessageCountResponseDto {
  @ApiProperty({description: '안읽은 메시지 카운트', example: 0})
  unreadCount: number;
}