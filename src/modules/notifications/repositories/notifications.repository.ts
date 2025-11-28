import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Notification, NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.notification.create({ data });
  }

  /**
   * 알림 목록 조회 (페이지네이션)
   */
  async findMany(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: {
          userId,
        },
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      unreadCount,
    };
  }

  /**
   * 읽음 처리
   *
   * @param id
   * @param userId 소유자 아이디 (🔐 소유자만 업데이트 허용)
   *
   * @returns 업데이트 개수 반환
   */
  async markAsRead(id: string, userId: string): Promise<{ count: number }> {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  /**
   * 전체 읽음 처리
   */
  async markAllAsRead(userId: string): Promise<{ count: number }> {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * 알림 삭제
   *
   * @param id
   * @param userId 소유자 아이디 (🔐 소유자만 삭제 허용)
   * 
   * @returns 삭제된 객체 반환
   */
  async delete(id: string, userId: string): Promise<Notification> {
    return this.prisma.notification.delete({ where: { id, userId } });
  }

  /**
   * 안읽은 알림 수 조회
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }
}
