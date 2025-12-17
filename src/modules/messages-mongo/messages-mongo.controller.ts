import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, JwtAuthGuard } from '../auth';
import { MessagesMongoService } from './messages-mongo.service';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PaginationDto } from '@/common/dto';
import { ApiChatRoomIdParam } from './decorators/api-chatroom-id.decorator';
import { SkipThrottle } from '@nestjs/throttler';
import { UnreadMessageCountResponseDto } from './dto/unread-message-count.response.dto';
import { ApiResponseDeco } from './decorators/api.response.decorator';
import { sendMessageDto } from './dto/send-message.dto';
import { CreateChatRoomDto } from './dto/create-chat-room.dto';
import { PaginatedResult, PaginationOptions } from '@/common/types';
import { MessageEntity } from './domain/entities/message.entity';
import { ChatRoomEntity } from './domain/entities/chat-room.entity';
import { PaginationPipe } from '@/common/pipe/pagination.pipe';

@Controller('messages-mongo')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class MessagesMongoController {
  constructor(private readonly service: MessagesMongoService) {}

  /**
   * 대화방 생성 또는 조회
   */
  @Post('/chatroom')
  @ApiOperation({ summary: '대화방 생성 또는 조회' })
  async findOrCreateChatRoom(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateChatRoomDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ChatRoomEntity> {
    const { chatRoom, isCreated } = await this.service.findOrCreateChatroom(
      userId,
      dto.receiverId,
      dto.productId,
    );

    // 생성 시 201, 조회 시 200
    res.status(isCreated ? HttpStatus.CREATED : HttpStatus.OK);

    return chatRoom;
  }
  
  /**
   * 대화방 메시지 히스토리 조회
   */
  @Get('/chatroom/:roomId/messages')
  @ApiOperation({ summary: '대화 메시지 조회' })
  @ApiChatRoomIdParam()
  async getMessagesByRoomId(
    @Param('roomId') roomId: string,
    @Query(ValidationPipe, PaginationPipe)
    pagination: Required<PaginationOptions>,
  ): Promise<PaginatedResult<MessageEntity>> {
    return this.service.findMessagesByRoomId(roomId, pagination);
  }

  /**
   * 메시지 전송 (Post)
   * @param userId
   * @param dto
   */
  @Post()
  @ApiOperation({ summary: '메시지 전송' })
  async sendMessage(
    @CurrentUser('userId') userId: string,
    @Body() dto: sendMessageDto,
  ): Promise<void> {
    await this.service.sendMessage(
      dto.chatRoomId,
      userId,
      dto.receiverId,
      dto.content,
      dto.messageType,
    );
  }

  /**
   * 메시지 읽음 처리
   */
  @Patch('chatrooms/:roomId/read')
  @ApiOperation({ summary: '메시지 읽음 처리' })
  @ApiChatRoomIdParam()
  async markMessageAsRead(
    @CurrentUser('userId') userId: string,
    @Param('roomId') roomId: string,
  ): Promise<{ modifiedCount: number }> {
    const modifiedCount = await this.service.markMessagesAsRead(roomId, userId);
    return { modifiedCount };
  }

  /**
   * 안 읽은 메시지 카운트 조회
   */
  @Get('chatrooms/:roomId/unread-count')
  @ApiOperation({ summary: '안 읽은 메시지 카운트 조회' })
  @ApiChatRoomIdParam()
  @ApiResponseDeco(UnreadMessageCountResponseDto)
  @SkipThrottle({ short: true, medium: true })
  async getUnreadMessageCountByRoom(
    @CurrentUser('userId') userId: string,
    @Param('roomId') roomId: string,
  ): Promise<{ unreadCount: number }> {
    const unreadCount = await this.service.countUnreadMessagesByRoom(
      roomId,
      userId,
    );
    return { unreadCount };
  }

  /**
   * 대화방 나가기
   * - 대화방에서 사용자 나감 처리
   * - 모든 사용자가 나가면 대화방 삭제, 메시지 삭제
   */
  @Delete('chatrooms/:roomId/leave')
  @ApiOperation({ summary: '대화방 나가기' })
  async leaveChatroom(
    @CurrentUser('userId') userId: string,
    @Param('roomId') chatroomId: string,
  ): Promise<void> {
    await this.service.leaveChatroom(chatroomId, userId);
  }
}
