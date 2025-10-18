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
   * @param id 사용자 ID
   * @returns 비활성화된 사용자
   */
  async softDelete(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
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
