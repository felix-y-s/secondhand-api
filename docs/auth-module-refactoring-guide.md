# AuthModule 리팩토링 가이드

## 목적
현재 각 모듈에서 중복으로 등록되고 있는 `JwtStrategy`를 `AuthModule`로 통합하여 관리합니다.

## 현재 문제점

### 중복 등록 현황
```typescript
// categories.module.ts
@Module({
  providers: [JwtStrategy, CategoriesService], // ❌ 중복
})

// users.module.ts
@Module({
  providers: [JwtStrategy, UsersService], // ❌ 중복
})

// favorites.module.ts
@Module({
  providers: [JwtStrategy, FavoritesService], // ❌ 중복
})

// products.module.ts
@Module({
  providers: [JwtStrategy, ProductsService], // ❌ 중복
})
```

### 문제점
1. **중복 등록**: 모든 모듈에서 `JwtStrategy`를 반복 등록
2. **유지보수 어려움**: `JwtStrategy` 변경 시 모든 모듈 수정 필요
3. **NestJS 패턴 위반**: 공통 기능은 모듈로 분리하는 것이 원칙

## 리팩토링 작업 단계

### 1단계: AuthModule 생성

#### 1.1 디렉토리 구조 생성
```bash
mkdir -p src/modules/auth
```

#### 1.2 AuthModule 파일 생성
```typescript
// src/modules/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from '@/common/auth/strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get('JWT_ACCESS_EXPIRATION'),
        },
      }),
    }),
  ],
  providers: [JwtStrategy],
  exports: [JwtStrategy, PassportModule, JwtModule], // 다른 모듈에서 사용 가능
})
export class AuthModule {}
```

### 2단계: AppModule에 AuthModule 등록

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
// ... 기타 imports

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // ...
    }),
    AuthModule, // ✅ 추가
    PrismaModule,
    CategoriesModule,
    UsersModule,
    ProductsModule,
    FavoritesModule,
    // ...
  ],
})
export class AppModule {}
```

### 3단계: 각 모듈에서 AuthModule import 및 JwtStrategy 제거

#### 3.1 CategoriesModule 수정
```typescript
// src/modules/categories/categories.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from '@/modules/auth/auth.module'; // ✅ 추가

@Module({
  imports: [AuthModule], // ✅ 추가
  providers: [
    // JwtStrategy, // ❌ 제거
    CategoriesService,
    CategoriesRepository,
  ],
  controllers: [CategoriesController],
  exports: [CategoriesService],
})
export class CategoriesModule {}
```

#### 3.2 UsersModule 수정
```typescript
// src/modules/users/users.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from '@/modules/auth/auth.module'; // ✅ 추가

@Module({
  imports: [AuthModule], // ✅ 추가
  providers: [
    // JwtStrategy, // ❌ 제거
    UsersService,
    UsersRepository,
  ],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
```

#### 3.3 ProductsModule 수정
```typescript
// src/modules/products/products.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from '@/modules/auth/auth.module'; // ✅ 추가

@Module({
  imports: [AuthModule], // ✅ 추가
  providers: [
    // JwtStrategy, // ❌ 제거
    ProductsService,
    ProductsRepository,
  ],
  controllers: [ProductsController],
  exports: [ProductsService],
})
export class ProductsModule {}
```

#### 3.4 FavoritesModule 수정
```typescript
// src/modules/favorites/favorites.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from '@/modules/auth/auth.module'; // ✅ 추가
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [
    AuthModule,      // ✅ 추가
    ProductsModule,  // 기존
  ],
  providers: [
    // JwtStrategy, // ❌ 제거
    FavoritesService,
    FavoritesRepository,
  ],
  controllers: [FavoritesController],
})
export class FavoritesModule {}
```

### 4단계: 검증

#### 4.1 빌드 확인
```bash
npm run build
```

#### 4.2 테스트 실행
```bash
# 단위 테스트
npm run test

# E2E 테스트
npm run test:e2e
```

#### 4.3 수동 테스트
```bash
# 개발 서버 실행
npm run start:dev

# 인증이 필요한 API 호출 테스트
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/v1/categories
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/v1/favorites
```

## 리팩토링 전후 비교

### Before (각 모듈에 중복 등록)
```typescript
// 4개 모듈에서 중복
CategoriesModule: providers: [JwtStrategy, ...]
UsersModule:      providers: [JwtStrategy, ...]
ProductsModule:   providers: [JwtStrategy, ...]
FavoritesModule:  providers: [JwtStrategy, ...]
```

### After (AuthModule 중앙 관리)
```typescript
AuthModule:       providers: [JwtStrategy], exports: [JwtStrategy]
CategoriesModule: imports: [AuthModule]
UsersModule:      imports: [AuthModule]
ProductsModule:   imports: [AuthModule]
FavoritesModule:  imports: [AuthModule]
```

## 장점

### 1. 중앙 관리
- `JwtStrategy` 설정을 한 곳(`AuthModule`)에서 관리
- 설정 변경 시 `AuthModule`만 수정

### 2. 재사용성
- 모든 모듈에서 `AuthModule` import만으로 인증 기능 사용
- 새로운 모듈 추가 시 `imports: [AuthModule]`만 추가

### 3. 유지보수성
- `JwtStrategy` 변경 시 `AuthModule`만 수정
- 각 도메인 모듈은 인증 로직에서 분리됨

### 4. NestJS 모범 사례
- 공통 기능은 모듈로 분리하는 NestJS 패턴 준수
- 명확한 모듈 간 의존성 관리

## 추가 고려사항

### 향후 확장 가능성
`AuthModule`에 추가할 수 있는 기능들:
- Refresh Token 전략
- OAuth2 전략 (Google, Kakao 등)
- 2FA (Two-Factor Authentication)
- API Key 인증
- Role-based Guard
- Permission-based Guard

### 예시: AuthModule 확장
```typescript
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({ /* ... */ }),
  ],
  providers: [
    JwtStrategy,
    RefreshTokenStrategy,  // ✅ 추가 가능
    GoogleStrategy,        // ✅ 추가 가능
    RolesGuard,           // ✅ 추가 가능
  ],
  exports: [
    JwtStrategy,
    RefreshTokenStrategy,
    GoogleStrategy,
    RolesGuard,
    PassportModule,
    JwtModule,
  ],
})
export class AuthModule {}
```

## 체크리스트

- [ ] `src/modules/auth/auth.module.ts` 파일 생성
- [ ] `AppModule`에 `AuthModule` import 추가
- [ ] `CategoriesModule`에서 `JwtStrategy` 제거 및 `AuthModule` import
- [ ] `UsersModule`에서 `JwtStrategy` 제거 및 `AuthModule` import
- [ ] `ProductsModule`에서 `JwtStrategy` 제거 및 `AuthModule` import
- [ ] `FavoritesModule`에서 `JwtStrategy` 제거 및 `AuthModule` import
- [ ] 빌드 성공 확인 (`npm run build`)
- [ ] 단위 테스트 통과 확인 (`npm run test`)
- [ ] E2E 테스트 통과 확인 (`npm run test:e2e`)
- [ ] 수동 테스트로 인증 기능 동작 확인
- [ ] Git commit 및 push

## 참고 자료

- [NestJS Authentication 공식 문서](https://docs.nestjs.com/security/authentication)
- [NestJS Module 공식 문서](https://docs.nestjs.com/modules)
- [Passport JWT Strategy](http://www.passportjs.org/packages/passport-jwt/)
