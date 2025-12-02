import { Module } from '@nestjs/common';
import { TransactionLoggerService } from './transaction-logger.service';

/**
 * 로거 모듈
 *
 * 커스텀 로거 서비스들을 제공하는 글로벌 모듈
 * - TransactionLoggerService: 거래 추적 로그
 */
@Module({
  providers: [TransactionLoggerService],
  exports: [TransactionLoggerService],
})
export class LoggerModule {}
