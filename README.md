# 중고거래사이트 백엔드 API

NestJS 기반 중고거래 플랫폼 백엔드 서비스

## 📋 프로젝트 개요

안전하고 확장 가능한 중고거래 플랫폼을 위한 백엔드 API 서비스입니다.

**기술 스택**: NestJS + Express, PostgreSQL, MongoDB, Redis, RabbitMQ, Elasticsearch

## 🚀 빠른 시작

### 개발환경 실행

```bash
# 환경변수 설정
cp .env.example .env.development

# SSL 인증서 생성 (개발용)
chmod +x scripts/generate-ssl.sh
./scripts/generate-ssl.sh

# 개발환경 실행
docker-compose -f docker-compose.dev.yml up -d

# 애플리케이션 로그 확인
docker-compose -f docker-compose.dev.yml logs -f app-dev
```

### 프로덕션 실행

```bash
# 환경변수 설정
cp .env.example .env.production

# 프로덕션 환경 실행
docker-compose up -d

# 상태 확인
docker-compose ps
```

## 📊 서비스 구성

| 서비스 | 포트 | 목적 |
|---------|------|------|
| NestJS App | 3000 | 메인 API 서버 |
| PostgreSQL | 5432 | 주 데이터베이스 |
| PostgreSQL Replica | 5433 | 읽기 전용 복제본 |
| MongoDB | 27017 | 문서 데이터베이스 |
| Redis | 6379 | 캐시 및 세션 |
| RabbitMQ | 5672/15672 | 메시지 큐 |
| Elasticsearch | 9200 | 검색 엔진 |
| Nginx | 80/443 | 로드밸런서 |

## 🛠️ 개발 도구

### 데이터베이스 접속

```bash
# PostgreSQL
docker exec -it secondhand-postgres-dev psql -U nestjs -d secondhand_dev

# MongoDB
docker exec -it secondhand-mongodb-dev mongosh -u root -p password

# Redis
docker exec -it secondhand-redis-dev redis-cli
```

### 관리 UI 접속

- RabbitMQ 관리 UI: http://localhost:15672 (rabbitmq/password)
- Elasticsearch: http://localhost:9200

## 📁 프로젝트 구조

```
src/
├── events/              # 이벤트 아키텍처
├── queues/              # 메시지 큐 시스템  
├── integrations/        # 외부 API 연동
├── compliance/          # 규정 준수 모듈
├── security/            # 보안 및 사기 탐지
├── auth/                # 인증/인가
├── users/               # 사용자 관리
├── products/            # 상품 관리
├── orders/              # 주문 처리
├── payments/            # 결제 시스템
├── shipping/            # 배송 관리
├── chat/                # 실시간 채팅
├── notifications/       # 알림 서비스
└── common/              # 공통 모듈
```

## 🔧 환경 설정

### 필수 환경변수

개발환경에서는 `.env.development` 파일을 생성하여 다음 항목들을 설정하세요:

- 데이터베이스 연결 정보
- JWT 시크릿 키
- 외부 API 키 (결제, 배송, SMS 등)
- Redis 및 RabbitMQ 설정

### 보안 주의사항

- 프로덕션에서는 강력한 비밀번호 사용
- JWT 시크릿 키는 충분히 복잡하게 설정
- 외부 API 키는 실제 서비스 키로 교체

## 📚 문서

- [PRD 문서](./docs/1.%20PRD_중고거래사이트_백엔드.md) - 프로젝트 요구사항 명세서
- [개발 계획서](./docs/2.%20개발계획서_중고거래사이트_백엔드.md) - 16주 개발 로드맵

## 🏗️ 아키텍처

### 하이브리드 데이터베이스 전략
- **PostgreSQL**: 트랜잭션, 사용자, 주문 데이터
- **MongoDB**: 상품, 리뷰, 채팅 메시지
- **Redis**: 캐시, 세션, Rate Limiting
- **Elasticsearch**: 상품 검색 및 분석

### 이벤트 기반 아키텍처
- **Event Sourcing**: 거래 상태 변경 추적
- **CQRS**: 읽기/쓰기 분리
- **Saga Pattern**: 분산 트랜잭션 관리

## 📄 라이선스

MIT Licensed
