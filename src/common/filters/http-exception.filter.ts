import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

/**
 * HTTP 예외 필터
 * 모든 예외를 포착하여 일관된 응답 형식으로 변환
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 기본 에러 응답 구조
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: any = undefined;

    // 1. HttpException 처리
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || exception.message;
        errors = responseObj.errors || responseObj.error;
      }
    }
    // 2. Prisma 에러 처리
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const prismaError = this.handlePrismaError(exception);
      status = prismaError.status;
      message = prismaError.message;
    }
    // 3. Prisma Validation 에러 처리
    else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = '데이터 유효성 검사 실패';
    }
    // 4. 기타 에러 처리
    else if (exception instanceof Error) {
      message = exception.message;
    }

    // 에러 로깅
    this.logger.error(
      `${request.method} ${request.url} - Status: ${status} - Message: ${message}`,
      exception instanceof Error ? exception.stack : '',
    );

    // 응답 반환 (TransformInterceptor와 동일한 형식)
    response.status(status).json({
      success: false,
      statusCode: status,
      error: {
        message,
        ...(errors && { details: errors }),
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Prisma 에러를 HTTP 에러로 변환
   */
  private handlePrismaError(error: Prisma.PrismaClientKnownRequestError): {
    status: number;
    message: string;
  } {
    switch (error.code) {
      // 고유 제약 조건 위반
      case 'P2002': {
        const field = (error.meta?.target as string[]) || [];
        return {
          status: HttpStatus.CONFLICT,
          message: `${field.join(', ')} 필드가 이미 존재합니다`,
        };
      }

      // 레코드를 찾을 수 없음
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          message: '요청한 리소스를 찾을 수 없습니다',
        };

      // 외래 키 제약 조건 위반
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: '참조된 리소스가 존재하지 않습니다',
        };

      // 필수 필드 누락
      case 'P2011':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: '필수 필드가 누락되었습니다',
        };

      // 데이터 형식 오류
      case 'P2006':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: '잘못된 데이터 형식입니다',
        };

      // 연결 실패
      case 'P1001':
      case 'P1002':
        return {
          status: HttpStatus.SERVICE_UNAVAILABLE,
          message: '데이터베이스 연결에 실패했습니다',
        };

      // 기본 에러
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: '데이터베이스 오류가 발생했습니다',
        };
    }
  }
}
