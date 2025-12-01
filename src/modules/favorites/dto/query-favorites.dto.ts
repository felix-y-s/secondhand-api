import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class QueryFavoritesDto {
  @Type(() => Number)
  @IsInt({ message: 'page는 정수여야 합니다.' })
  @Min(1, { message: 'page는 1 이상이어야 합니다.' })
  page?: number = 1;

  @Type(() => Number)
  @IsInt({ message: 'limit는 정수여야 합니다.' })
  @Min(1, { message: 'limit는 1 이상이어야 합니다.' })
  @Max(100, { message: 'limit는 100 이하여야 합니다.' })
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if(value.toLowerCase() === 'createdat') return 'createdAt';
    if(value.toLowerCase() === 'updatedat') return 'updatedAt';
    return value;
  })
  @IsIn(['createdAt', 'updatedAt'], {
    message: 'order는 createdAt 또는 updatedAt 중 하나여야 합니다.',
  })
  order?: 'createdAt' | 'updatedAt' = 'createdAt';

  @IsOptional()
  @Transform(({ value }) => value.toUpperCase())
  @IsIn(['ASC', 'DESC'], {
    message: 'sort는 ASC 또는 DESC 중 하나여야 합니다.',
  })
  sort?: 'ASC' | 'DESC' = 'DESC';
}