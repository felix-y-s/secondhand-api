import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: '헬스 체크',
    description: 'API 서버 상태 확인을 위한 헬스 체크 엔드포인트'
  })
  @ApiResponse({
    status: 200,
    description: '서버 정상 작동',
    schema: {
      type: 'string',
      example: 'Hello World!'
    }
  })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({
    summary: '서버 상태 확인',
    description: '서버의 현재 상태와 버전 정보를 반환합니다.'
  })
  @ApiResponse({
    status: 200,
    description: '서버 상태 정보',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2025-10-16T10:00:00.000Z' },
        version: { type: 'string', example: '1.0.0' }
      }
    }
  })
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }
}
