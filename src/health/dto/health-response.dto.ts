import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 서비스 상태
 */
export class ServiceStatus {
  @ApiProperty({
    description: '서비스 상태',
    enum: ['healthy', 'unhealthy'],
    example: 'healthy',
  })
  status: 'healthy' | 'unhealthy';

  @ApiProperty({
    description: '응답 시간 (밀리초)',
    example: 15,
  })
  responseTime: number;

  @ApiProperty({
    description: '상태 메시지',
    example: 'PostgreSQL 연결 정상',
  })
  message: string;

  @ApiPropertyOptional({
    description: '에러 메시지 (상태가 unhealthy인 경우)',
    example: 'Connection refused',
  })
  error?: string;
}

/**
 * 기본 헬스체크 응답
 */
export class HealthResponseDto {
  @ApiProperty({
    description: '서버 상태',
    enum: ['ok', 'not_ready'],
    example: 'ok',
  })
  status: string;

  @ApiProperty({
    description: '응답 시간 (ISO 8601)',
    example: '2025-10-17T10:30:00Z',
  })
  timestamp: string;

  @ApiProperty({
    description: '서버 가동 시간 (초)',
    example: 3600,
  })
  uptime: number;
}

/**
 * 상세 헬스체크 응답
 */
export class DetailedHealthResponseDto extends HealthResponseDto {
  @ApiProperty({
    description: '전체 시스템 상태',
    enum: ['healthy', 'degraded'],
    example: 'healthy',
  })
  declare status: string;

  @ApiProperty({
    description: '헬스체크 응답 시간 (밀리초)',
    example: 45,
  })
  responseTime: number;

  @ApiProperty({
    description: '연동 서비스 상태',
  })
  services: {
    postgres: ServiceStatus;
    mongodb: ServiceStatus;
    redis: ServiceStatus;
  };
}
