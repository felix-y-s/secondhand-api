import { Injectable } from '@nestjs/common';
import { Notification, NotificationType } from '@prisma/client';
import { NotificationsRepository } from './repositories/notifications.repository';

@Injectable()
export class NotificationsService {
  constructor(private readonly repository: NotificationsRepository) {}

  /**
   * 알림 생성
   */
  async create(data: {
      userId: string;
      type: NotificationType;
      title: string;
      message: string;
      relatedId?: string;
      relatedType?: string;
    }): Promise<Notification> {
      return this.repository.create(data);
  }

  /**
   * 내 알림 목록 조회
   */
  async findMyNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    items: Notification[];
    total: number;
    page: number;
    totalPages: number;
    unreadCount: number;
  }> {
    return this.repository.findMany(userId, page, limit);
  }

  /**
   * 읽음 처리
   */
  async markAsRead(id: string, userId: string): Promise<{ count: number }> {
    return this.repository.markAsRead(id, userId);
  }

  /**
   * 전체 읽음 처리
   */
  async markAllAsRead(userId: string): Promise<{ count: number}> {
    return this.repository.markAllAsRead(userId);
  }

  /**
   * 알림 삭제
   */
  async delete(id: string, userId: string): Promise<Notification> {
    return this.repository.delete(id, userId);
  }

  /**
   * 안 읽은 알림 수 조회
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.repository.getUnreadCount(userId);
  }
}