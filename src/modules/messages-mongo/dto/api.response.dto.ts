import { ApiProperty } from '@nestjs/swagger';

export class ApiResponseDto<T> {
  @ApiProperty({ description: '성공 유무', example: true })
  success: boolean;
  @ApiProperty({ description: '상태코드', example: 200 })
  statusCode: number;
  @ApiProperty({ description: '결과 데이터' })
  data: T;
  @ApiProperty({
    description: '타임스탬프',
    example: '2025-12-08T18:35:33.891Z',
  })
  timestamp: string;
}