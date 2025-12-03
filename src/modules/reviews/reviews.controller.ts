import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import {
  CreateReviewDto,
  UpdateReviewDto,
  QueryReviewsDto,
  ReviewResponseDto,
  ReviewsListResponseDto,
  TrustScoreResponseDto,
} from './dto';
import { JwtAuthGuard, RolesGuard } from '@/modules/auth';
import { CurrentUser, type JwtValidationResult } from '@/modules/auth';
import {
  ApiCreateResponses,
  ApiDeleteResponses,
  ApiGetResponses,
} from '@/common/decorators';

/**
 * Reviews Controller
 * 리뷰 관련 HTTP 요청 처리
 */
@Controller('reviews')
@ApiTags('reviews')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /**
   * 리뷰 작성
   */
  @Post()
  @ApiOperation({
    summary: '리뷰 작성',
    description: '거래 완료 후 리뷰를 작성합니다',
  })
  @ApiBearerAuth('access-token')
  @ApiCreateResponses(ReviewResponseDto, '리뷰가 생성되었습니다')
  async create(
    @CurrentUser() user: JwtValidationResult,
    @Body() createReviewDto: CreateReviewDto,
  ) {
    const review = await this.reviewsService.create(
      user.userId,
      createReviewDto,
    );
    return {
      success: true,
      message: '리뷰가 작성되었습니다',
      data: review,
    };
  }

  /**
   * 사용자별 리뷰 목록
   */
  @ApiOperation({ summary: '사용자별 리뷰 목록 조회' })
  @ApiGetResponses(ReviewsListResponseDto)
  @Get('user')
  async getUsersReviews(@Query() queryDto: QueryReviewsDto) {
    return this.reviewsService.findAll(queryDto);
  }

  /**
   * 내가 받은 리뷰 목록
   */
  @Get('received')
  @ApiOperation({
    summary: '내가 받은 리뷰 조회',
    description: '리뷰 목록을 조회합니다 (페이지내이션, 필터링 지원)',
  })
  @ApiBearerAuth('access-token')
  @ApiGetResponses(ReviewsListResponseDto)
  async getReceivedReviews(
    @CurrentUser('userId') userId: string,
    @Query() queryDto: QueryReviewsDto,
  ) {
    return this.reviewsService.findAll({
      ...queryDto,
      reviewedId: userId, // 내가 받은 리뷰
    });
  }

  /**
   * 내가 작성한 리뷰 목록
   */
  @Get('given')
  @ApiOperation({ summary: '내가 작성한 리뷰 목록' })
  @ApiBearerAuth('access-token')
  @ApiGetResponses(ReviewsListResponseDto)
  async getGivenReviews(
    @CurrentUser('userId') userId: string,
    @Query() queryDto: QueryReviewsDto,
  ) {
    return this.reviewsService.findAll({
      ...queryDto,
      reviewerId: userId, // 내가 작성한 리뷰
    });
  }

  /**
   * 주문별 리뷰 조회
   *
   * @설계의도
   * 이 엔드포인트는 "특정 주문에 대한 리뷰 존재 여부 확인" 용도입니다.
   * - 리뷰가 없는 경우(null): 정상 상태 (아직 작성 전) → 200 OK
   * - 리뷰가 있는 경우: 정상 상태 → 200 OK
   * - 404는 반환하지 않음: 리뷰 미작성은 에러가 아닌 정상 상태
   *
   * @사용사례
   * 1. 주문 상세 페이지에서 "리뷰 작성 가능 여부" 판단
   * 2. 리뷰 작성 전 중복 체크
   * 3. UI에서 "리뷰 작성" vs "리뷰 보기" 버튼 표시 결정
   */
  @Get('order/:orderId')
  @ApiOperation({
    summary: '주문별 리뷰 조회',
    description: '특정 주문의 리뷰를 조회합니다',
  })
  @ApiParam({ name: 'orderId', description: '주문 ID' })
  @ApiGetResponses(ReviewResponseDto)
  async findByOrder(@Param('orderId') orderId: string) {
    const review = await this.reviewsService.findByOrderId(orderId);
    return {
      success: true,
      message: review
        ? '리뷰 정보를 조회했습니다'
        : '리뷰가 아직 작성되지 않았습니다',
      data: review,
    };
  }

  /**
   * 리뷰 상세 조회
   */
  @Get(':id')
  @ApiOperation({
    summary: '리뷰 상세 조회',
    description: '리뷰 상세 정보를 조회합니다',
  })
  @ApiParam({ name: 'id', description: '리뷰 ID' })
  @ApiGetResponses(ReviewResponseDto)
  async findOne(@Param('id') id: string) {
    const review = await this.reviewsService.findOne(id);
    return {
      success: true,
      message: '리뷰 정보를 조회했습니다',
      data: review,
    };
  }

  /**
   * 사용자 신뢰도 점수 조회
   */
  @Get('trust/:userId')
  @ApiOperation({
    summary: '사용자 신뢰도 점수 조회',
    description: '사용자의 신뢰도 점수와 리뷰 통계를 조회합니다',
  })
  @ApiParam({ name: 'userId', description: '사용자 ID' })
  @ApiGetResponses(TrustScoreResponseDto)
  async getTrustScore(@Param('userId') userId: string) {
    const trustScore = await this.reviewsService.getTrustScore(userId);
    return {
      success: true,
      message: '신뢰도 점수를 조회했습니다',
      data: trustScore,
    };
  }

  /**
   * 리뷰 수정
   */
  @Patch(':id')
  @ApiOperation({
    summary: '리뷰 수정',
    description: '작성한 리뷰를 수정합니다',
  })
  @ApiParam({ name: 'id', description: '리뷰 ID' })
  @ApiGetResponses(ReviewResponseDto)
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateReviewDto: UpdateReviewDto,
  ) {
    const review = await this.reviewsService.update(
      id,
      req.user.userId,
      updateReviewDto,
    );
    return {
      success: true,
      message: '리뷰가 수정되었습니다',
      data: review,
    };
  }

  /**
   * 리뷰 삭제
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '리뷰 삭제',
    description: '작성한 리뷰를 삭제합니다',
  })
  @ApiParam({ name: 'id', description: '리뷰 ID' })
  @ApiDeleteResponses()
  async remove(@Request() req, @Param('id') reviewId: string) {
    await this.reviewsService.remove(reviewId, req.user.userId);
    return {
      success: true,
      message: '리뷰가 삭제되었습니다',
    };
  }
}
