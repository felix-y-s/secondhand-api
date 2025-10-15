import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma 서비스
 * 데이터베이스 연결 및 트랜잭션 관리를 담당하는 글로벌 서비스
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  /**
   * 모듈 초기화 시 데이터베이스 연결
   */
  async onModuleInit() {
    await this.$connect();
  }

  /**
   * 모듈 종료 시 데이터베이스 연결 해제
   */
  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * 데이터베이스 초기화 (테스트 환경에서만 사용)
   * @warning 프로덕션 환경에서는 절대 사용하지 말 것
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('데이터베이스 초기화는 프로덕션에서 사용할 수 없습니다');
    }

    const models = Object.keys(this).filter(
      (key) =>
        !key.startsWith('_') && !key.startsWith('$') && typeof this[key] === 'object',
    );

    return Promise.all(
      models.map((modelKey) => {
        if (this[modelKey]?.deleteMany) {
          return this[modelKey].deleteMany();
        }
      }),
    );
  }
}
