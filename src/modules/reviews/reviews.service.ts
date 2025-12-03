import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ReviewsRepository } from './repositories/reviews.repository';
import {
  CreateReviewDto,
  UpdateReviewDto,
  QueryReviewsDto,
} from './dto';
import { Review } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { OrderStatus } from '@prisma/client';
import { OrdersService } from '../orders/orders.service';

/**
 * 리뷰 Service
 * 비즈니스 로직 처리
 */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly reviewsRepository: ReviewsRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 리뷰 작성
   * @param userId 작성자 ID
   * @param createReviewDto 리뷰 작성 DTO
   * @returns 생성된 리뷰
   */
  async create(
    userId: string,
    createReviewDto: CreateReviewDto,
  ): Promise<Review> {
    const { orderId, rating, comment, images = [] } = createReviewDto;

    // 1. 주문 존재 여부 및 완료 상태 확인
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: true,
        seller: true,
        product: true,
      },
    });

    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다');
    }

    // 2. 주문이 완료되었는지 확인 (CONFIRMED 또는 DELIVERED 상태)
    if (
      order.status !== OrderStatus.CONFIRMED &&
      order.status !== OrderStatus.DELIVERED
    ) {
      throw new BadRequestException(
        '완료된 주문에만 리뷰를 작성할 수 있습니다',
      );
    }

    // 3. 구매자 또는 판매자만 리뷰 작성 가능
    const isBuyer = order.buyerId === userId;
    const isSeller = order.sellerId === userId;

    if (!isBuyer && !isSeller) {
      throw new ForbiddenException(
        '이 주문에 대한 리뷰를 작성할 권한이 없습니다',
      );
    }

    // 4. 이미 리뷰가 작성되었는지 확인
    const existingReview = await this.reviewsRepository.findByOrderId(orderId);
    if (existingReview) {
      throw new BadRequestException('이미 리뷰가 작성된 주문입니다');
    }

    // 5. 리뷰 대상자 결정 (구매자가 작성하면 판매자가 대상, 판매자가 작성하면 구매자가 대상)
    const reviewedId = isBuyer ? order.sellerId : order.buyerId;

    // 6. 리뷰 생성
    const review = await this.reviewsRepository.create({
      rating,
      comment,
      images,
      order: { connect: { id: orderId } },
      reviewer: { connect: { id: userId } },
      reviewed: { connect: { id: reviewedId } },
    });

    // 7. 리뷰 대상자의 신뢰도 점수 업데이트
    await this.reviewsRepository.updateUserTrustScore(reviewedId);

    return review;
  }

  /**
   * 리뷰 상세 조회
   * @param id 리뷰 ID
   * @returns 리뷰 정보
   */
  async findOne(id: string): Promise<Review> {
    const review = await this.reviewsRepository.findById(id);
    if (!review) {
      throw new NotFoundException('리뷰를 찾을 수 없습니다');
    }

    return review;
  }

  /**
   * 리뷰 목록 조회 (페이지네이션)
   * @param queryDto 조회 조건
   * @returns 리뷰 목록 및 메타데이터
   */
  async findAll(queryReviewsDto: QueryReviewsDto) {
    const { page = 1, limit = 20 } = queryReviewsDto;

    const [reviews, total] = await Promise.all([
      this.reviewsRepository.findMany(queryReviewsDto),
      this.reviewsRepository.count(queryReviewsDto),
    ]);

    return {
      reviews,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 주문별 리뷰 조회
   * @param orderId 주문 ID
   * @returns 리뷰 또는 null
   */
  async findByOrderId(orderId: string): Promise<Review | null> {
    await this.ordersService.findById(orderId);
    return this.reviewsRepository.findByOrderId(orderId);
  }

  /**
   * 사용자 신뢰도 점수 조회
   * @param userId 사용자 ID
   * @returns 신뢰도 점수 정보
   */
  async getTrustScore(userId: string) {
    // 사용자 존재 여부 확인
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        trustScore: true,
        rating: true,
        ratingCount: true,
      },
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }

    // 최신 신뢰도 점수 계산
    const trustScoreData =
      await this.reviewsRepository.calculateTrustScore(userId);

    return {
      userId: user.id,
      ...trustScoreData,
    };
  }

  /**
   * 리뷰 수정
   * @param id 리뷰 ID
   * @param userId 현재 사용자 ID
   * @param updateReviewDto 수정 DTO
   * @returns 수정된 리뷰
   */
  async update(
    id: string,
    userId: string,
    updateReviewDto: UpdateReviewDto,
  ): Promise<Review> {
    // 1. 리뷰 존재 여부 확인
    const review = await this.reviewsRepository.findById(id);
    if (!review) {
      throw new NotFoundException('리뷰를 찾을 수 없습니다');
    }

    // 2. 작성자만 수정 가능
    if (review.reviewerId !== userId) {
      throw new ForbiddenException('리뷰를 수정할 권한이 없습니다');
    }

    // 3. 리뷰 수정
    const updatedReview = await this.reviewsRepository.update(
      id,
      updateReviewDto,
    );

    // 4. 평점이 변경되었으면 신뢰도 점수 재계산
    if (updateReviewDto.rating !== undefined) {
      await this.reviewsRepository.updateUserTrustScore(review.reviewedId);
    }

    return updatedReview;
  }

  /**
   * 리뷰 삭제
   * @param id 리뷰 ID
   * @param userId 현재 사용자 ID
   * @returns 삭제된 리뷰
   */
  async remove(id: string, userId: string): Promise<Review> {
    // 1. 리뷰 존재 여부 확인
    const review = await this.reviewsRepository.findById(id);
    if (!review) {
      throw new NotFoundException('리뷰를 찾을 수 없습니다');
    }

    // 2. 작성자만 삭제 가능
    if (review.reviewerId !== userId) {
      throw new ForbiddenException('리뷰를 삭제할 권한이 없습니다');
    }

    // 3. 리뷰 대상자 ID 저장 (삭제 전)
    const reviewedId = review.reviewedId;

    // 4. 리뷰 삭제
    const deletedReview = await this.reviewsRepository.delete(id);

    // 5. 신뢰도 점수 재계산
    await this.reviewsRepository.updateUserTrustScore(reviewedId);

    return deletedReview;
  }
}
