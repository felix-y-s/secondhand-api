import { CurrentUser, JwtAuthGuard } from '@/modules/auth';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { CreateChatRoomDto } from './dto/create-chatroom.dto';
import { QueryMessageDto } from './dto/query-messages.dto';
import { SendMessageDto } from './dto/send-message.dto';
@ApiTags('messages')
@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  /**
   * 채팅방 생성 또는 조회
   */
  @Post('chatrooms')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '채팅방 생성 또는 조회' })
  @ApiResponse({ status: 201, description: '채팅방 생성/조회 성공 ' })
  async createOrFindChatRoom(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateChatRoomDto,
  ) {
    return this.messagesService.findOrCreateChatRoom(userId, dto.productId);
  }

  /**
   * 내 채팅방 목록 조회
   */
  @Get('chatrooms')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '내 채팅방 목록 조회 ' })
  @ApiResponse({ status: 200, description: '채팅방 목록 조회 성공' })
  async getMyChatRooms(@CurrentUser('userId') userId: string) {
    return this.messagesService.findMyChatRooms(userId);
  }

  /**
   * 채팅방 메시지 히스토리 조회
   */
  @Get('chatrooms/:chatRoomId/messages')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '채팅방 메시지 조회' })
  @ApiResponse({ status: 200, description: '메시지 조회 성공' })
  async getMessages(
    @CurrentUser('userId') userId: string,
    @Param('chatRoomId') chatRoomId: string,
    @Query() query: QueryMessageDto,
  ) {
    return this.messagesService.findMessage(userId, chatRoomId, query.page);
  }

  /**
   * 메시지 전송
   */
  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '메시지 전송 ' })
  @ApiResponse({ status: 201, description: '메시지 전송 성공' })
  async sendMessage(
    @CurrentUser('userId') userId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.sendMessage(
      userId,
      dto.chatRoomId,
      dto.content,
      dto.messageType,
      dto.fileUrl,
      dto.fileName,
    );
  }

  /**
   * 읽음 처리
   */
  @Patch('chatrooms/:chatRoomId/read')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '메시지 읽음 처리' })
  @ApiResponse({ status: 200, description: '읽음 처리 성공' })
  async markAdRead(
    @CurrentUser('userId') userId: string,
    @Param('chatRoomId') chatRoomId: string,
  ) {
    await this.messagesService.markAsRead(chatRoomId, userId);
  }

  /**
   * 채팅방 나가기
   */
  @Delete('chatrooms/:chatRoomId')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '채팅방 나가기' })
  @ApiResponse({ status: 200, description: '채팅방 나가기' })
  async leaveChatRoom(
    @CurrentUser('userId') userId: string,
    @Param('chatRoomId') chatRoomId: string,
  ) {
    await this.messagesService.leaveChatRoom(chatRoomId, userId);
  }
}
