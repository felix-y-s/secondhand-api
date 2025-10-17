import { IsUUID, IsInt, IsString, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * UUID 파라미터 DTO
 *
 * URL 파라미터로 UUID를 받을 때 사용
 * @example /users/:id (where id is UUID)
 */
export class UuidParamDto {
  @ApiProperty({
    description: 'UUID 형식의 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('all', { message: 'ID는 유효한 UUID 형식이어야 합니다' })
  id: string;
}

/**
 * 정수 ID 파라미터 DTO
 *
 * URL 파라미터로 정수 ID를 받을 때 사용
 * @example /products/:id (where id is integer)
 */
export class IntIdParamDto {
  @ApiProperty({
    description: '정수 형식의 ID',
    example: 123,
  })
  @Type(() => Number)
  @IsInt({ message: 'ID는 정수여야 합니다' })
  id: number;
}

/**
 * 문자열 ID 파라미터 DTO
 *
 * URL 파라미터로 문자열 ID를 받을 때 사용 (MongoDB ObjectId 등)
 * @example /categories/:id (where id is string)
 */
export class StringIdParamDto {
  @ApiProperty({
    description: '문자열 형식의 ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString({ message: 'ID는 문자열이어야 합니다' })
  @IsNotEmpty({ message: 'ID는 비어있을 수 없습니다' })
  id: string;
}
