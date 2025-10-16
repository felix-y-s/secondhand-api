# 멀티스테이지 빌드 - NestJS 프로덕션 최적화
# Stage 1: 빌드 환경
FROM node:18-alpine AS builder

# 작업 디렉토리 설정
WORKDIR /usr/src/app

# pnpm 설치
RUN npm install -g pnpm

# 패키지 파일 복사 및 의존성 설치
COPY package*.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 소스 코드 복사
COPY . .

# 애플리케이션 빌드
RUN pnpm run build

# Stage 2: 프로덕션 환경
FROM node:18-alpine AS production

# 보안을 위한 non-root 사용자 생성
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# 작업 디렉토리 설정
WORKDIR /usr/src/app

# pnpm 설치
RUN npm install -g pnpm

# 프로덕션 의존성만 설치
COPY package*.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile && pnpm store prune

# 빌드된 애플리케이션 복사
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/node_modules ./node_modules

# 사용자 전환
USER nestjs

# 포트 노출
EXPOSE 3000

# 헬스체크 추가
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node dist/health-check.js || exit 1

# 애플리케이션 시작
CMD ["node", "dist/main.js"]