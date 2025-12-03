import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 리뷰 작성 DTO
 */
export class CreateReviewDto {
  @ApiProperty({
    description: '주문 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty({ message: '주문 ID는 필수입니다' })
  @IsString({ message: '주문 ID는 문자열이어야 합니다' })
  orderId: string;

  @ApiProperty({
    description: '평점 (1-5)',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @IsNotEmpty({ message: '평점은 필수입니다' })
  @IsInt({ message: '평점은 정수여야 합니다' })
  @Min(1, { message: '평점은 최소 1점입니다' })
  @Max(5, { message: '평점은 최대 5점입니다' })
  rating: number;

  @ApiPropertyOptional({
    description: '리뷰 내용',
    example: '좋은 거래였습니다. 감사합니다!',
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: '리뷰 내용은 문자열이어야 합니다' })
  @MaxLength(500, { message: '리뷰 내용은 최대 500자입니다' })
  comment?: string;

  @ApiPropertyOptional({
    description: '리뷰 이미지 URL 배열',
    example: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: '이미지는 배열이어야 합니다' })
  @IsString({ each: true, message: '각 이미지 URL은 문자열이어야 합니다' })
  images?: string[];
}
