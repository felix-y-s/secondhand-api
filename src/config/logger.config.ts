import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { utilities as nestWinstonModuleUtilities } from 'nest-winston';

/**
 * 민감정보 마스킹 함수
 * 로그에서 비밀번호, 카드번호, 이메일, 전화번호 등을 자동으로 마스킹
 */
const maskSensitiveData = winston.format((info) => {
  const message = JSON.stringify(info);

  // 비밀번호 마스킹
  info.message = message
    .replace(/"password":\s*"[^"]*"/g, '"password": "****"')
    .replace(/"passwordHash":\s*"[^"]*"/g, '"passwordHash": "****"')
    // 카드 번호 마스킹
    .replace(/\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/g, '****-****-****-****')
    // 이메일 부분 마스킹
    .replace(/([a-zA-Z0-9._-]+)@/g, '***@')
    // 전화번호 마스킹
    .replace(/\d{3}[-\s]?\d{3,4}[-\s]?\d{4}/g, '***-****-****');

  return info;
});

/**
 * Winston 로거 설정
 * - 콘솔 출력 (개발 환경)
 * - 파일 로테이션 (프로덕션 환경)
 * - 민감정보 자동 마스킹
 * - 거래 로그 별도 보관
 */
export const winstonConfig: WinstonModuleOptions = {
  transports: [
    // 콘솔 출력 (개발 환경)
    new winston.transports.Console({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.ms(),
        nestWinstonModuleUtilities.format.nestLike('SecondhandAPI', {
          colors: true,
          prettyPrint: true,
        }),
      ),
    }),

    // 에러 로그 파일 (프로덕션)
    new DailyRotateFile({
      level: 'error',
      dirname: 'logs',
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: winston.format.combine(
        winston.format.timestamp(),
        maskSensitiveData(),
        winston.format.json(),
      ),
    }),

    // 전체 로그 파일 (프로덕션)
    new DailyRotateFile({
      level: 'info',
      dirname: 'logs',
      filename: 'combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: winston.format.combine(
        winston.format.timestamp(),
        maskSensitiveData(),
        winston.format.json(),
      ),
    }),

    // 거래 로그 파일 (별도 보관)
    new DailyRotateFile({
      level: 'info',
      dirname: 'logs/transactions',
      filename: 'transaction-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '50m',
      maxFiles: '30d', // 30일 보관 (전자상거래법 준수)
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),

    // 디버그 로그 (개발 환경만)
    ...(process.env.NODE_ENV !== 'production'
      ? [
          new DailyRotateFile({
            level: 'debug',
            dirname: 'logs',
            filename: 'debug-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '3d',
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json(),
            ),
          }),
        ]
      : []),
  ],

  // 예외 및 거부된 프로미스 처리
  exceptionHandlers: [
    new DailyRotateFile({
      dirname: 'logs',
      filename: 'exceptions-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
    }),
  ],

  rejectionHandlers: [
    new DailyRotateFile({
      dirname: 'logs',
      filename: 'rejections-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
    }),
  ],
};
