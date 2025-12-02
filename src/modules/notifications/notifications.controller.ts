import { CurrentUser, JwtAuthGuard } from '@/modules/auth';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { Notification } from '@prisma/client';
import { CreateNotificationDto, PaginationQueryDto } from './dto';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * 알림 생성
   */
  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '알림 생성' })
  async create(@Body() dto: CreateNotificationDto): Promise<Notification> {
    return this.notificationsService.create(dto);
  }

  /**
   * 내 알림 목록 조회
   */
  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '내 알림 목록 조회' })
  async getMyNotifications(
    @CurrentUser('userId') userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.notificationsService.findMyNotifications(
      userId,
      query.page,
      query.limit,
    );
  }

  /**
   * 안읽은 알림 수 조회
   */
  @Get('unread/count')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '안읽은 알림 수 조회' })
  async getUnreadCount(@CurrentUser('userId') userId: string) {
    const count = await this.notificationsService.getUnreadCount(userId);
    return { unreadCount: count };
  }

  /**
   * 알림 읽음 처리
   */
  @Patch(':id/read')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '알림 읽음 처리' })
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
  ) {
    await this.notificationsService.markAsRead(id, userId);
    return { success: true };
  }

  /**
   * 알림 삭제
   */
  @Delete(':id/delete')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '알림 삭제' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.notificationsService.delete(id, userId);
  }
}
