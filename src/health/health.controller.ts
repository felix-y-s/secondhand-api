import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle, ApiPublicResponses } from '@/common/decorators';
import { Public } from '@/modules/auth';
import { HealthService } from './health.service';
import {
  HealthResponseDto,
  DetailedHealthResponseDto,
} from './dto/health-response.dto';

/**
 * 헬스체크 컨트롤러
 *
 * 시스템 상태 확인을 위한 헬스체크 엔드포인트
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * 기본 헬스체크
   *
   * 서버 실행 여부만 확인하는 단순 헬스체크
   * 로드밸런서, 모니터링 도구에서 사용
   */
  @ApiOperation({
    summary: '기본 헬스체크',
    description:
      '서버 실행 여부를 확인합니다. Rate Limiting이 적용되지 않습니다.',
  })
  @ApiPublicResponses(200, HealthResponseDto, '서버 정상 동작 중')
  @Public()
  @SkipThrottle()
  @Get()
  check(): HealthResponseDto {
    return this.healthService.check();
  }

  /**
   * 상세 헬스체크
   *
   * 데이터베이스, 캐시 등 연동 서비스 상태 확인
   * 내부 모니터링 용도
   */
  @ApiOperation({
    summary: '상세 헬스체크',
    description: 'PostgreSQL, MongoDB, Redis 연결 상태를 포함한 상세 헬스체크',
  })
  @ApiPublicResponses(
    200,
    DetailedHealthResponseDto,
    '서버 및 데이터베이스 상태 정상',
  )
  @Public()
  @SkipThrottle()
  @Get('detailed')
  async detailedCheck(): Promise<DetailedHealthResponseDto> {
    return this.healthService.detailedCheck();
  }

  /**
   * Readiness Probe
   *
   * 서버가 트래픽을 받을 준비가 되었는지 확인
   * Kubernetes readiness probe용
   */
  @ApiOperation({
    summary: 'Readiness Probe',
    description:
      '서버가 트래픽을 받을 준비가 되었는지 확인합니다 (Kubernetes용)',
  })
  @ApiPublicResponses(200, HealthResponseDto, '트래픽 수신 준비 완료')
  @Public()
  @SkipThrottle()
  @Get('ready')
  async ready(): Promise<HealthResponseDto> {
    return this.healthService.readinessCheck();
  }

  /**
   * Liveness Probe
   *
   * 서버가 살아있는지 확인
   * Kubernetes liveness probe용
   */
  @ApiOperation({
    summary: 'Liveness Probe',
    description: '서버가 정상적으로 동작 중인지 확인합니다 (Kubernetes용)',
  })
  @ApiPublicResponses(200, HealthResponseDto, '서버 정상 동작 중')
  @Public()
  @SkipThrottle()
  @Get('live')
  live(): HealthResponseDto {
    return this.healthService.check();
  }
}
