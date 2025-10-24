import { PartialType } from '@nestjs/swagger';
import { CreateReviewDto } from './create-review.dto';
import { OmitType } from '@nestjs/swagger';

/**
 * 리뷰 수정 DTO
 * orderId는 수정 불가
 */
export class UpdateReviewDto extends PartialType(
  OmitType(CreateReviewDto, ['orderId'] as const),
) {}
