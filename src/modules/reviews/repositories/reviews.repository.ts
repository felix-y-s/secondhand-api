import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Review, Prisma } from '@prisma/client';
import { QueryReviewsDto } from '../dto';

/**
 * 리뷰 Repository
 * 데이터베이스 접근 로직 캡슐화
 */
@Injectable()
export class ReviewsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 리뷰 생성
   * @param data 생성할 리뷰 데이터
   * @returns 생성된 리뷰
   */
  async create(data: Prisma.ReviewCreateInput): Promise<Review> {
    return this.prisma.review.create({
      data,
      include: {
        reviewer: {
          select: {
            id: true,
            nickname: true,
            profileImage: true,
          },
        },
        reviewed: {
          select: {
            id: true,
            nickname: true,
            profileImage: true,
            trustScore: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            product: {
              select: {
                id: true,
                title: true,
                thumbnail: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * ID로 리뷰 조회
   * @param id 리뷰 ID
   * @returns 리뷰 또는 null
   */
  async findById(id: string): Promise<Review | null> {
    return this.prisma.review.findUnique({
      where: { id },
      include: {
        reviewer: {
          select: {
            id: true,
            nickname: true,
            profileImage: true,
          },
        },
        reviewed: {
          select: {
            id: true,
            nickname: true,
            profileImage: true,
            trustScore: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            product: {
              select: {
                id: true,
                title: true,
                thumbnail: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * 주문 ID로 리뷰 조회
   * @param orderId 주문 ID
   * @returns 리뷰 또는 null
   */
  async findByOrderId(orderId: string): Promise<Review | null> {
    return this.prisma.review.findUnique({
      where: { orderId },
      include: {
        reviewer: {
          select: {
            id: true,
            nickname: true,
            profileImage: true,
          },
        },
        reviewed: {
          select: {
            id: true,
            nickname: true,
            profileImage: true,
            trustScore: true,
          },
        },
      },
    });
  }

  /**
   * 리뷰 목록 조회 (페이지네이션 + 필터)
   * @param query 조회 조건
   * @returns 리뷰 목록
   */
  async findMany(query: QueryReviewsDto): Promise<Review[]> {
    const { reviewerId, reviewedId, minRating, maxRating, page = 1, limit = 20 } = query;

    const where: Prisma.ReviewWhereInput = {
      ...(reviewerId && { reviewerId }),
      ...(reviewedId && { reviewedId }),
      ...(minRating && { rating: { gte: minRating } }),
      ...(maxRating && { rating: { lte: maxRating } }),
      ...(minRating && maxRating && {
        rating: {
          gte: minRating,
          lte: maxRating,
        },
      }),
    };

    return this.prisma.review.findMany({
      where,
      include: {
        reviewer: {
          select: {
            id: true,
            nickname: true,
            profileImage: true,
          },
        },
        reviewed: {
          select: {
            id: true,
            nickname: true,
            profileImage: true,
            trustScore: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            product: {
              select: {
                id: true,
                title: true,
                thumbnail: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  /**
   * 리뷰 총 개수 조회
   * @param query 조회 조건
   * @returns 총 개수
   */
  async count(query: QueryReviewsDto): Promise<number> {
    const { reviewerId, reviewedId, minRating, maxRating } = query;

    const where: Prisma.ReviewWhereInput = {
      ...(reviewerId && { reviewerId }),
      ...(reviewedId && { reviewedId }),
      ...(minRating && { rating: { gte: minRating } }),
      ...(maxRating && { rating: { lte: maxRating } }),
      ...(minRating && maxRating && {
        rating: {
          gte: minRating,
          lte: maxRating,
        },
      }),
    };

    return this.prisma.review.count({ where });
  }

  /**
   * 리뷰 수정
   * @param id 리뷰 ID
   * @param data 수정할 데이터
   * @returns 수정된 리뷰
   */
  async update(id: string, data: Prisma.ReviewUpdateInput): Promise<Review> {
    return this.prisma.review.update({
      where: { id },
      data,
      include: {
        reviewer: {
          select: {
            id: true,
            nickname: true,
            profileImage: true,
          },
        },
        reviewed: {
          select: {
            id: true,
            nickname: true,
            profileImage: true,
            trustScore: true,
          },
        },
      },
    });
  }

  /**
   * 리뷰 삭제
   * @param id 리뷰 ID
   * @returns 삭제된 리뷰
   */
  async delete(id: string): Promise<Review> {
    return this.prisma.review.delete({
      where: { id },
    });
  }

  /**
   * 사용자의 신뢰도 점수 계산
   * @param userId 사용자 ID
   * @returns 신뢰도 점수 정보
   */
  async calculateTrustScore(userId: string): Promise<{
    trustScore: number;
    averageRating: number;
    totalReviews: number;
    ratingDistribution: Record<number, number>;
  }> {
    // 받은 리뷰 조회
    const reviews = await this.prisma.review.findMany({
      where: { reviewedId: userId },
      select: { rating: true },
    });

    const totalReviews = reviews.length;

    if (totalReviews === 0) {
      return {
        trustScore: 0,
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }

    // 평균 평점 계산
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / totalReviews;

    // 평점별 분포 계산
    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((review) => {
      ratingDistribution[review.rating]++;
    });

    // 신뢰도 점수 계산 (0-100)
    // 평균 평점 기반 점수 (80%) + 리뷰 개수 보너스 (20%)
    const ratingScore = (averageRating / 5) * 80;
    const reviewCountBonus = Math.min(totalReviews / 50, 1) * 20; // 최대 50개 리뷰까지 보너스
    const trustScore = Math.round((ratingScore + reviewCountBonus) * 10) / 10; // 소수점 1자리

    return {
      trustScore,
      averageRating: Math.round(averageRating * 10) / 10,
      totalReviews,
      ratingDistribution,
    };
  }

  /**
   * 사용자의 신뢰도 점수 업데이트
   * @param userId 사용자 ID
   * @returns 업데이트된 사용자
   */
  async updateUserTrustScore(userId: string): Promise<void> {
    const { trustScore, averageRating, totalReviews } = await this.calculateTrustScore(userId);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        trustScore,
        rating: averageRating,
        ratingCount: totalReviews,
      },
    });
  }
}
