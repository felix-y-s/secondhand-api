/**
 * 애플리케이션 설정 파일
 * - 환경 변수를 구조화된 객체로 변환
 * - 타입 안정성 제공
 */
export default () => ({
  // 애플리케이션 기본 설정
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    apiPrefix: process.env.API_PREFIX || 'api',
    apiVersion: process.env.API_VERSION || 'v1',
    corsOrigin: process.env.CORS_ORIGIN?.split(',') || [
      'http://localhost:3000',
    ],
  },

  // 데이터베이스 설정
  database: {
    postgres: {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5433', 10),
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres123',
      database: process.env.POSTGRES_DB || 'secondhand_db',
      url: process.env.DATABASE_URL,
    },
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/secondhand_db',
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
    },
  },

  // RabbitMQ 설정
  rabbitmq: {
    host: process.env.RABBITMQ_HOST || 'localhost',
    port: parseInt(process.env.RABBITMQ_PORT || '5674', 10),
    user: process.env.RABBITMQ_USER || 'admin',
    password: process.env.RABBITMQ_PASSWORD || 'admin123',
    vhost: process.env.RABBITMQ_VHOST || '/',
    managementPort: parseInt(
      process.env.RABBITMQ_MANAGEMENT_PORT || '15674',
      10,
    ),
  },

  // JWT 인증 설정
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-super-secret-jwt-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET || 'dev-super-secret-refresh-key',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // 보안 설정
  security: {
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),
    throttleTtl: parseInt(process.env.THROTTLE_TTL || '60', 10),
    throttleLimit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
  },

  // AWS S3 설정
  aws: {
    region: process.env.AWS_REGION || 'ap-northeast-2',
    s3Bucket: process.env.AWS_S3_BUCKET || 'secondhand-uploads-dev',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },

  // 파일 업로드 설정
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
    allowedFileTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ],
  },

  // 로깅 설정
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
    dir: process.env.LOG_DIR || 'logs',
    maxFiles: process.env.LOG_MAX_FILES || '30d',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD',
  },

  // 결제 게이트웨이 설정
  payment: {
    apiKey: process.env.PAYMENT_API_KEY,
    secretKey: process.env.PAYMENT_SECRET_KEY,
    webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET,
  },

  // FCM 알림 설정
  fcm: {
    serverKey: process.env.FCM_SERVER_KEY,
    projectId: process.env.FCM_PROJECT_ID,
  },

  // Swagger 설정
  swagger: {
    enabled: process.env.SWAGGER_ENABLED === 'true',
    path: process.env.SWAGGER_PATH || 'api-docs',
  },

  // 디버그 모드
  debug: process.env.DEBUG === 'true',
});
