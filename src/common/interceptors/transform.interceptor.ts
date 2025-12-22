import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response as ExpressResponse } from 'express';
import { Response, PaginatedResult } from '../types';

/**
 * 응답 변환 인터셉터
 *
 * 모든 성공 응답을 일관된 형식으로 변환:
 *
 * 일반 응답:
 * {
 *   success: true,
 *   statusCode: 200,
 *   data: { ... },
 *   timestamp: "..."
 * }
 *
 * 페이지네이션 응답:
 * {
 *   success: true,
 *   statusCode: 200,
 *   data: {
 *     items: [...],
 *     meta: { total, page, limit, ... }
 *   },
 *   timestamp: "..."
 * }
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
        const response = context.switchToHttp().getResponse<ExpressResponse>();
        const request = context.switchToHttp().getRequest<Request>();
        const statusCode = response.statusCode;

        // 이미 변환된 응답인지 확인 (success 필드가 있으면 변환된 것으로 간주)
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        // 페이지네이션 응답 처리 ({ items, meta } 구조 감지)
        if (
          data &&
          typeof data === 'object' &&
          'items' in data &&
          'meta' in data
        ) {
          return {
            success: true,
            statusCode,
            data: {
              items: (data as PaginatedResult<any>).items,
              meta: (data as PaginatedResult<any>).meta,
            },
            timestamp: new Date().toISOString(),
            path: request.path,
          };
        }

        // 일반 응답 데이터 변환
        return {
          success: true,
          statusCode,
          data,
          timestamp: new Date().toISOString(),
          path: request.path,
        };
      }),
    );
  }
}
