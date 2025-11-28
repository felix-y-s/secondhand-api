import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * 공통 응답 인터페이스
 */
export interface Response<T> {
  success: boolean;
  statusCode: number;
  message?: string;
  data?: T;
  timestamp: string;
}

/**
 * 응답 변환 인터셉터
 * 모든 성공 응답을 일관된 형식으로 변환
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => {
        // 컨트롤러 실행 후에 statusCode 읽기 (@HttpCode 데코레이터 적용된 값)
        const response = context.switchToHttp().getResponse();
        const statusCode = response.statusCode;

        // 이미 변환된 응답인지 확인 (success 필드가 있으면 변환된 것으로 간주)
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        // 응답 데이터 변환
        return {
          success: true,
          statusCode,
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
