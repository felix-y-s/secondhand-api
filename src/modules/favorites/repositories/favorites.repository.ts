import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Favorite } from '@prisma/client';

@Injectable()
export class FavoritesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 찜하기 추가
   */
  async create(userId: string, productId: string): Promise<Favorite> {
    return await this.prisma.favorite.create({
      data: {
        userId,
        productId,
      },
      include: {
        product: {
          include: {
            category: true,
            seller: {
              select: {
                id: true,
                nickname: true,
                profileImage: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * 찜하기 목록 조회 (페이지네이션)
   */
  async findMany(
    userId: string,
    page: number = 1,
    limit: number = 20,
    order: string = 'createdAt',
    sort: 'DESC' | 'ASC' = 'DESC',
  ) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.favorite.findMany({
        where: { userId },
        take: limit,
        skip,
        orderBy: { [order]: sort.toLowerCase() },
        include: {
          product: {
            include: {
              category: true,
              seller: {
                select: {
                  id: true,
                  nickname: true,
                  profileImage: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.favorite.count({ where: { userId } }),
    ]);
    const totalPage = Math.ceil(total / limit);
    const hasNext = page < totalPage;
    return {
      items,
      page,
      limit,
      total,
      totalPage,
      hasNext,
    };
  }

  /**
   * 찜하기 여부 확인
   */
  async exist(userId: string, productId: string) {
    return !!(
      (await this.prisma.favorite.count({
        where: { AND: { userId, productId } },
      })) > 0
    );
  }

  /**
   * 찜하기 삭제
   */
  async delete(userId: string, productId: string) {
    return this.prisma.favorite.deleteMany({
      where: { userId, productId },
    });
  }
}
