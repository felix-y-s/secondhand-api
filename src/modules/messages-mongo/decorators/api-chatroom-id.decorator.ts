import { applyDecorators } from '@nestjs/common';
import { ApiParam } from '@nestjs/swagger';

export function ApiChatRoomIdParam() {
  return applyDecorators(
    ApiParam({
      name: 'roomId',
      description: '대화방 아이디',
      example:
        '123e4567-e89b-12d3-a456-426614174000-a8fc60dc-ec32-42c3-aaaf-34ba17b0ea77',
    }),
  );
}