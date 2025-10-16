import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

/**
 * HTTP 요청/응답 로깅 인터셉터
 *
 * 모든 HTTP 요청과 응답을 자동으로 로깅
 * - 요청 시작 시간 기록
 * - 응답 시간 측정
 * - 사용자 정보 추적 (인증된 경우)
 * - 에러 상황 로깅
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;
    const userId = request.user?.userId || 'anonymous';
    const now = Date.now();

    // 요청 시작 로그
    this.logger.log(`📥 [${method}] ${url} - User: ${userId}`, 'HTTP');

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const statusCode = response.statusCode;
          const delay = Date.now() - now;

          // 응답 성공 로그
          this.logger.log(
            `📤 [${method}] ${url} ${statusCode} - ${delay}ms - User: ${userId}`,
            'HTTP',
          );
        },
        error: (error) => {
          const delay = Date.now() - now;

          // 응답 에러 로그
          this.logger.error(
            `❌ [${method}] ${url} ${error.status || 500} - ${delay}ms - User: ${userId}`,
            error.stack,
            'HTTP',
          );
        },
      }),
    );
  }
}
