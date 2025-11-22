import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { User, Prisma } from '@prisma/client';

/**
 * 사용자 Repository
 * 데이터베이스 접근 로직을 캡슐화
 */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 사용자 생성
   * @param data 생성할 사용자 데이터
   * @returns 생성된 사용자
   */
  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  /**
   * ID로 사용자 조회
   * @param id 사용자 ID
   * @returns 사용자 또는 null
   */
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * 이메일로 사용자 조회
   * @param email 이메일
   * @returns 사용자 또는 null
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * 닉네임으로 사용자 조회
   * @param nickname 닉네임
   * @returns 사용자 또는 null
   */
  async findByNickname(nickname: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { nickname },
    });
  }

  /**
   * 전화번호로 사용자 조회
   * @param phoneNumber 전화번호
   * @returns 사용자 또는 null
   */
  async findByPhoneNumber(phoneNumber: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { phoneNumber },
    });
  }

  /**
   * 사용자 정보 수정
   * @param id 사용자 ID
   * @param data 수정할 데이터
   * @returns 수정된 사용자
   */
  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  /**
   * 사용자 삭제 (하드 삭제)
   * @param id 사용자 ID
   * @returns 삭제된 사용자
   */
  async delete(id: string): Promise<User> {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  /**
   * 사용자 소프트 삭제 (isActive = false)
   * @description
   * - PENDING 상태 주문 CANCELLED 처리
   * - 판매 중인 상품 DELETED 처리
   * - 사용자 계정 비활성화(softDelete)
   * - 데드락 발생 시 3회 재시도
   *
   * @todo 탈퇴 후 30일 경과 시 개인정보 익명화 처리 job 추가
   * @todo 탈퇴 후 5년 경과 (법적 보존 기간 만료) job 추가
   *
   * @param id 사용자 ID
   */
  async softDelete(id: string): Promise<User> {
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return this.prisma.$transaction(
          async (prisma) => {
            // 1. PENDING | PAYMENT_PENDING 상태 주문 자동 취소
            await prisma.order.updateMany({
              where: {
                OR: [{ sellerId: id }, { buyerId: id }],
                status: { in: ['PENDING', 'PAYMENT_PENDING'] },
              },
              data: {
                status: 'CANCELLED',
              },
            });

            // 2. 판매 중인 상품만 DELETED 상태로 변경
            // (RESERVED, SOLD 상태는 이미 거래 완료된 것이므로 유지)
            await prisma.product.updateMany({
              where: {
                sellerId: id,
                status: 'ACTIVE',
              },
              data: {
                status: 'DELETED',
              },
            });

            // 3. 사용자 계정 비활성화
            return prisma.user.update({
              where: { id },
              data: { isActive: false },
            });
          },
          {
            maxWait: 5000, // 5초 대기(락 대기 시간)
            timeout: 10000, // 10 초 타임아웃(트랜잭션 수행 시간)
            isolationLevel: 'ReadCommitted', // 트랜잭션 중 커밋된 데이터만 읽을 수 있도록 보장. Dirty Read는 방지되지만 Non-repeatable read는 발생 가능
            /**
             * - dirty read: 커밋되지 않은 데이터를 읽음
             * - non-repeatable: 같은 쿼리 반복 시 결과가 달라짐 → 예: 잔액 조회 두 번 했는데 값이 달라짐
             * - Serializable: 완전 격리, 모든 문제 방지하지만 느리고 충돌 많음 → 꼭 필요한 경우에만!
             */
          },
        );
      } catch (error) {
        // prisma deadlock error: P2034
        if (error.code === 'P2034' && attempt < MAX_RETRIES - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, 100 * (attempt + 1)),
          );
          continue;
        }
        throw error;
      }
    }

    // 논리적으로 여기에 도달할 수는 없지만 typescript 안전 보장
    throw new Error('Soft delete retry limit exceeded');
  }

  /**
   * 마지막 로그인 시간 업데이트
   * @param id 사용자 ID
   * @returns 업데이트된 사용자
   */
  async updateLastLogin(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  /**
   * 여러 사용자 조회
   * @param params 조회 파라미터
   * @returns 사용자 목록
   */
  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput;
  }): Promise<User[]> {
    const { skip, take, where, orderBy } = params;
    return this.prisma.user.findMany({
      skip,
      take,
      where,
      orderBy,
    });
  }

  /**
   * 사용자 수 카운트
   * @param where 조건
   * @returns 사용자 수
   */
  async count(where?: Prisma.UserWhereInput): Promise<number> {
    return this.prisma.user.count({ where });
  }
}
