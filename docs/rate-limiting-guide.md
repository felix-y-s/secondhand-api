# Rate Limiting 사용 가이드

## 개요

Rate Limiting은 API 엔드포인트에 대한 요청 횟수를 제한하여 서버 리소스를 보호하고 API 남용을 방지하는 보안 메커니즘입니다.

## 설정된 제한 레벨

### 1. Short (짧은 시간 제한)
- **제한**: 1분당 10회
- **용도**: 로그인, 회원가입, 비밀번호 재설정 등 민감한 API
- **적용 이유**: 무차별 대입 공격(Brute Force) 방지

```typescript
@Throttle({ short: { ttl: 60000, limit: 10 } })
@Post('auth/login')
async login(@Body() dto: LoginDto) {
  return this.authService.login(dto);
}
```

### 2. Medium (중간 시간 제한)
- **제한**: 1분당 30회
- **용도**: 일반 CRUD API (생성, 수정, 삭제)
- **적용 이유**: 일반적인 API 남용 방지

```typescript
@Throttle({ medium: { ttl: 60000, limit: 30 } })
@Post('products')
async createProduct(@Body() dto: CreateProductDto) {
  return this.productsService.create(dto);
}
```

### 3. Long (긴 시간 제한)
- **제한**: 1분당 100회
- **용도**: 읽기 전용 API (조회, 검색)
- **적용 이유**: 높은 트래픽 허용하면서도 과도한 요청 방지

```typescript
@Throttle({ long: { ttl: 60000, limit: 100 } })
@Get('products')
async getProducts(@Query() query: SearchDto) {
  return this.productsService.findAll(query);
}
```

## Rate Limiting 제외

### @SkipThrottle() 데코레이터

특정 엔드포인트를 Rate Limiting에서 제외하려면 `@SkipThrottle()` 데코레이터를 사용합니다.

```typescript
import { SkipThrottle } from '@/common/decorators';

@SkipThrottle()
@Get('health')
healthCheck() {
  return { status: 'ok', timestamp: new Date().toISOString() };
}
```

**제외가 필요한 경우**:
- 헬스체크 엔드포인트
- 모니터링 엔드포인트
- Webhook 수신 엔드포인트
- 내부 시스템 전용 API

## 전역 설정

### 기본 동작

Rate Limiting은 **전역 가드**로 설정되어 있어 모든 엔드포인트에 자동으로 적용됩니다.

```typescript
// app.module.ts
providers: [
  {
    provide: APP_GUARD,
    useClass: CustomThrottlerGuard,
  },
]
```

### 기본 제한

특별한 데코레이터가 없는 경우 기본 제한은 **forRoot(Async)에서 등록된 모든 프로파일이 동시에 적용**됩니다.
특정 프로파일만 적용하려면 해당 이름을 데코레이터에 명시하세요(예: `@Throttle({ long: {} })`).

## 사용 시나리오

### 1. 인증 관련 API (Short 제한)

```typescript
// 로그인 (1분당 10회)
@Throttle({ short: { ttl: 60000, limit: 10 } })
@Post('auth/login')
async login(@Body() dto: LoginDto) {
  return this.authService.login(dto);
}

// 회원가입 (1분당 10회)
@Throttle({ short: { ttl: 60000, limit: 10 } })
@Post('auth/register')
async register(@Body() dto: RegisterDto) {
  return this.authService.register(dto);
}

// 비밀번호 재설정 요청 (1분당 10회)
@Throttle({ short: { ttl: 60000, limit: 10 } })
@Post('auth/password-reset')
async requestPasswordReset(@Body() dto: PasswordResetDto) {
  return this.authService.requestPasswordReset(dto);
}
```

### 2. 데이터 생성/수정/삭제 API (Medium 제한)

```typescript
// 상품 생성 (1분당 30회)
@Throttle({ medium: { ttl: 60000, limit: 30 } })
@Post('products')
async createProduct(@Body() dto: CreateProductDto) {
  return this.productsService.create(dto);
}

// 상품 수정 (1분당 30회)
@Throttle({ medium: { ttl: 60000, limit: 30 } })
@Patch('products/:id')
async updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
  return this.productsService.update(id, dto);
}

// 상품 삭제 (1분당 30회)
@Throttle({ medium: { ttl: 60000, limit: 30 } })
@Delete('products/:id')
async deleteProduct(@Param('id') id: string) {
  return this.productsService.delete(id);
}
```

### 3. 읽기 전용 API (Long 제한)

```typescript
// 상품 목록 조회 (1분당 100회)
@Throttle({ long: { ttl: 60000, limit: 100 } })
@Get('products')
async getProducts(@Query() query: SearchDto) {
  return this.productsService.findAll(query);
}

// 상품 상세 조회 (1분당 100회)
@Throttle({ long: { ttl: 60000, limit: 100 } })
@Get('products/:id')
async getProduct(@Param('id') id: string) {
  return this.productsService.findOne(id);
}

// 상품 검색 (1분당 100회)
@Throttle({ long: { ttl: 60000, limit: 100 } })
@Get('products/search')
async searchProducts(@Query('keyword') keyword: string) {
  return this.productsService.search(keyword);
}
```

### 4. Rate Limiting 제외 API

```typescript
// 헬스체크 (제한 없음)
@SkipThrottle()
@Get('health')
healthCheck() {
  return { status: 'ok' };
}

// Swagger 문서 (제한 없음)
@SkipThrottle()
@Get('api-docs')
getApiDocs() {
  return 'Swagger UI';
}

// 내부 모니터링 (제한 없음)
@SkipThrottle()
@Get('metrics')
getMetrics() {
  return this.metricsService.getAll();
}
```

## 에러 응답

Rate Limiting을 초과하면 다음과 같은 에러가 반환됩니다:

```json
{
  "statusCode": 429,
  "message": "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
  "error": "Too Many Requests"
}
```

**HTTP 상태 코드**: `429 Too Many Requests`

### 제한 레벨별 에러 메시지

- **Short**: "로그인 시도 횟수가 너무 많습니다. 1분 후 다시 시도해주세요."
- **Medium**: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요."
- **Long**: "요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요."

## 프로덕션 환경 고려사항

### 1. Redis 저장소 사용 권장

현재는 메모리 기반 저장소를 사용하지만, 프로덕션 환경에서는 Redis를 사용하는 것을 권장합니다.

**이유**:
- 여러 서버 인스턴스 간 공유 가능 (수평 확장)
- 서버 재시작 시에도 제한 상태 유지
- 더 나은 성능과 안정성

**Redis 설정 예시**:
```typescript
ThrottlerModule.forRootAsync({
  imports: [RedisModule],
  inject: [RedisService],
  useFactory: (redisService: RedisService) => ({
    throttlers: [
      { name: 'short', ttl: 60000, limit: 10 },
      { name: 'medium', ttl: 60000, limit: 30 },
      { name: 'long', ttl: 60000, limit: 100 },
    ],
    storage: new ThrottlerStorageRedisService(redisService.getClient()),
  }),
}),
```

### 2. IP 기반 제한

기본적으로 IP 주소 기반으로 요청을 추적합니다. 프록시 뒤에서 실행되는 경우 `X-Forwarded-For` 헤더를 고려해야 합니다.

### 3. 인증된 사용자별 제한

JWT 토큰의 사용자 ID를 기반으로 제한을 적용할 수도 있습니다.

```typescript
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    // JWT 토큰에서 사용자 ID 추출
    return req.user?.userId || req.ip;
  }
}
```

### 4. 환경별 제한 값 조정

개발, 스테이징, 프로덕션 환경에 따라 제한 값을 다르게 설정할 수 있습니다.

```typescript
// .env 파일
THROTTLE_SHORT_LIMIT=10
THROTTLE_MEDIUM_LIMIT=30
THROTTLE_LONG_LIMIT=100

// app.module.ts
ThrottlerModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => [
    {
      name: 'short',
      ttl: 60000,
      limit: config.get('THROTTLE_SHORT_LIMIT', 10),
    },
    {
      name: 'medium',
      ttl: 60000,
      limit: config.get('THROTTLE_MEDIUM_LIMIT', 30),
    },
    {
      name: 'long',
      ttl: 60000,
      limit: config.get('THROTTLE_LONG_LIMIT', 100),
    },
  ],
}),
```

## 모니터링

Rate Limiting 지표를 모니터링하여 적절한 제한 값을 설정하세요:

- 제한 초과 빈도
- 엔드포인트별 요청 패턴
- 사용자별 요청 분포
- 피크 시간대 트래픽

## 참고 자료

- [@nestjs/throttler ��식 문서](https://docs.nestjs.com/security/rate-limiting)
- [OWASP Rate Limiting 가이드](https://owasp.org/www-community/controls/Blocking_Brute_Force_Attacks)
- [HTTP 429 Too Many Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429)
