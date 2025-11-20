import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * WebSocket 연결 차단 미들웨어
 *
 * 목적:
 * - 구성되지 않은 Socket.IO 엔드포인트로의 연결 시도를 사전 차단
 * - 보안: 불필요한 WebSocket 연결 시도 방지
 * - 로그 노이즈 감소 (404 에러 로그 방지)
 *
 * 동작:
 * - /socket.io/* 경로로의 모든 요청을 즉시 차단
 * - 명확한 JSON 응답 반환 (WebSocket 미구성 안내)
 * - HttpExceptionFilter를 거치지 않고 직접 응답
 *
 * 제거 시점:
 * - Week 12: Messages 모듈에서 WebSocket 구현 시
 * - Socket.IO Gateway 설정 완료 후
 *
 * @see docs/개발계획서_2025_10_24_업데이트.md - Week 12: Messages 모듈
 */
@Injectable()
export class BlockWebSocketMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Socket.IO 경로 패턴 확인
    if (req.path.startsWith('/socket.io')) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: 'WebSocket is not configured on this server',
        error: 'Not Found',
        path: req.path,
        timestamp: new Date().toISOString(),
      });
    }

    next();
  }
}
