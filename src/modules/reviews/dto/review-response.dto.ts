import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 리뷰 응답 DTO
 */
export class ReviewResponseDto {
  @ApiProperty({
    description: '리뷰 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: '주문 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  orderId: string;

  @ApiProperty({
    description: '리뷰 작성자 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  reviewerId: string;

  @ApiProperty({
    description: '리뷰 대상자 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  reviewedId: string;

  @ApiProperty({
    description: '평점 (1-5)',
    example: 5,
  })
  rating: number;

  @ApiPropertyOptional({
    description: '리뷰 내용',
    example: '좋은 거래였습니다. 감사합니다!',
  })
  comment: string | null;

  @ApiProperty({
    description: '리뷰 이미지 URL 배열',
    example: ['https://example.com/image1.jpg'],
    type: [String],
  })
  images: string[];

  @ApiProperty({
    description: '생성일시',
    example: '2025-10-24T05:21:18.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: '수정일시',
    example: '2025-10-24T05:21:18.000Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: '리뷰 작성자 정보',
  })
  reviewer?: {
    id: string;
    nickname: string;
    profileImage: string | null;
  };

  @ApiPropertyOptional({
    description: '리뷰 대상자 정보',
  })
  reviewed?: {
    id: string;
    nickname: string;
    profileImage: string | null;
    trustScore: number;
  };
}

/**
 * 리뷰 목록 응답 DTO
 */
export class ReviewsListResponseDto {
  @ApiProperty({
    description: '리뷰 목록',
    type: [ReviewResponseDto],
  })
  reviews: ReviewResponseDto[];

  @ApiProperty({
    description: '전체 개수',
    example: 100,
  })
  total: number;

  @ApiProperty({
    description: '현재 페이지',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: '페이지 크기',
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: '전체 페이지 수',
    example: 5,
  })
  totalPages: number;
}

/**
 * 신뢰도 점수 응답 DTO
 */
export class TrustScoreResponseDto {
  @ApiProperty({
    description: '사용자 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  userId: string;

  @ApiProperty({
    description: '신뢰도 점수 (0-100)',
    example: 85.5,
  })
  trustScore: number;

  @ApiProperty({
    description: '평균 평점 (1-5)',
    example: 4.5,
  })
  averageRating: number;

  @ApiProperty({
    description: '총 리뷰 개수',
    example: 50,
  })
  totalReviews: number;

  @ApiProperty({
    description: '평점별 개수',
    example: {
      '1': 2,
      '2': 3,
      '3': 5,
      '4': 10,
      '5': 30,
    },
  })
  ratingDistribution: Record<number, number>;
}
