import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Order, Prisma, OrderStatus } from '@prisma/client';

/**
 * 주문 Repository
 * 데이터베이스 접근 로직 캡슐화
 */
@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 주문 생성
   * @param data 생성할 주문 데이터
   * @returns 생성된 주문
   */
  async create(data: Prisma.OrderCreateInput): Promise<Order> {
    return this.prisma.order.create({
      data,
      include: {
        buyer: {
          select: {
            id: true,
            nickname: true,
            email: true,
            profileImage: true,
          },
        },
        seller: {
          select: {
            id: true,
            nickname: true,
            email: true,
            profileImage: true,
          },
        },
        product: {
          select: {
            id: true,
            title: true,
            price: true,
            thumbnail: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * ID로 주문 조회
   * @param id 주문 ID
   * @returns 주문 또는 null
   */
  async findById(id: string): Promise<Order | null> {
    return this.prisma.order.findUnique({
      where: { id },
      include: {
        buyer: {
          select: {
            id: true,
            nickname: true,
            email: true,
            profileImage: true,
            phoneNumber: true,
          },
        },
        seller: {
          select: {
            id: true,
            nickname: true,
            email: true,
            profileImage: true,
            phoneNumber: true,
          },
        },
        product: {
          select: {
            id: true,
            title: true,
            description: true,
            price: true,
            thumbnail: true,
            images: true,
            status: true,
            condition: true,
          },
        },
        review: true,
      },
    });
  }

  /**
   * 주문 번호로 조회
   * @param orderNumber 주문 번호
   * @returns 주문 또는 null
   */
  async findByOrderNumber(orderNumber: string): Promise<Order | null> {
    return this.prisma.order.findUnique({
      where: { orderNumber },
      include: {
        buyer: {
          select: {
            id: true,
            nickname: true,
            email: true,
          },
        },
        seller: {
          select: {
            id: true,
            nickname: true,
            email: true,
          },
        },
        product: {
          select: {
            id: true,
            title: true,
            price: true,
            thumbnail: true,
          },
        },
      },
    });
  }

  /**
   * 주문 목록 조회 (페이지네이션 및 필터링)
   * @param params 조회 파라미터
   * @returns 주문 목록
   */
  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.OrderWhereInput;
    orderBy?: Prisma.OrderOrderByWithRelationInput;
    select?: Prisma.OrderSelect;
  }): Promise<Order[]> {
    const { skip, take, where, orderBy, select } = params;
    
    // select가 제공되면 select 사용, 아니면 기본 include 사용
    if (select) {
      return this.prisma.order.findMany({
        skip,
        take,
        where,
        orderBy,
        select,
      }) as Promise<Order[]>;
    }

    return this.prisma.order.findMany({
      skip,
      take,
      where,
      orderBy,
      include: {
        buyer: {
          select: {
            id: true,
            nickname: true,
            email: true,
            profileImage: true,
          },
        },
        seller: {
          select: {
            id: true,
            nickname: true,
            email: true,
            profileImage: true,
          },
        },
        product: {
          select: {
            id: true,
            title: true,
            price: true,
            thumbnail: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * 주문 수 카운트
   * @param where 조건
   * @returns 주문 수
   */
  async count(where?: Prisma.OrderWhereInput): Promise<number> {
    return this.prisma.order.count({ where });
  }

  /**
   * 주문 정보 수정
   * @param id 주문 ID
   * @param data 수정할 데이터
   * @returns 수정된 주문
   */
  async update(id: string, data: Prisma.OrderUpdateInput): Promise<Order> {
    return this.prisma.order.update({
      where: { id },
      data,
      include: {
        buyer: {
          select: {
            id: true,
            nickname: true,
            email: true,
          },
        },
        seller: {
          select: {
            id: true,
            nickname: true,
            email: true,
          },
        },
        product: {
          select: {
            id: true,
            title: true,
            price: true,
            thumbnail: true,
          },
        },
      },
    });
  }

  /**
   * 주문 삭제
   * @param id 주문 ID
   * @returns 삭제된 주문
   */
  async delete(id: string): Promise<Order> {
    return this.prisma.order.delete({
      where: { id },
    });
  }

  /**
   * 구매자의 주문 목록 조회
   * @param buyerId 구매자 ID
   * @param params 조회 파라미터
   * @returns 주문 목록
   */
  async findByBuyer(
    buyerId: string,
    params?: {
      skip?: number;
      take?: number;
      status?: OrderStatus;
    },
  ): Promise<Order[]> {
    const where: Prisma.OrderWhereInput = {
      buyerId,
      ...(params?.status && { status: params.status }),
    };

    return this.findMany({
      skip: params?.skip,
      take: params?.take,
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 판매자의 주문 목록 조회
   * @param sellerId 판매자 ID
   * @param params 조회 파라미터
   * @returns 주문 목록
   */
  async findBySeller(
    sellerId: string,
    params?: {
      skip?: number;
      take?: number;
      status?: OrderStatus;
    },
  ): Promise<Order[]> {
    const where: Prisma.OrderWhereInput = {
      sellerId,
      ...(params?.status && { status: params.status }),
    };

    return this.findMany({
      skip: params?.skip,
      take: params?.take,
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 상품의 주문 목록 조회
   * @param productId 상품 ID
   * @param params 조회 파라미터
   * @returns 주문 목록
   */
  async findByProduct(
    productId: string,
    params?: {
      skip?: number;
      take?: number;
      status?: OrderStatus;
    },
  ): Promise<Order[]> {
    const where: Prisma.OrderWhereInput = {
      productId,
      ...(params?.status && { status: params.status }),
    };

    return this.findMany({
      skip: params?.skip,
      take: params?.take,
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 주문 상태 변경
   * @param id 주문 ID
   * @param status 변경할 상태
   * @returns 업데이트된 주문
   */
  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const updateData: Prisma.OrderUpdateInput = {
      status,
    };

    // 상태에 따른 타임스탬프 업데이트
    switch (status) {
      case OrderStatus.PAID:
        updateData.paidAt = new Date();
        break;
      case OrderStatus.CONFIRMED:
        updateData.confirmedAt = new Date();
        break;
      case OrderStatus.DELIVERED:
        updateData.completedAt = new Date();
        break;
      case OrderStatus.CANCELLED:
      case OrderStatus.REFUNDED:
        updateData.cancelledAt = new Date();
        break;
    }

    return this.update(id, updateData);
  }

  /**
   * 주문 번호 생성 (유���크 체크)
   * @param prefix 접두사
   * @returns 생성된 주문 번호
   */
  async generateOrderNumber(prefix: string = 'ORD'): Promise<string> {
    let orderNumber: string;
    let exists = true;

    while (exists) {
      // 날짜 + 랜덤 숫자 조합
      const date = new Date();
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
      const random = Math.floor(Math.random() * 1000000)
        .toString()
        .padStart(6, '0');
      orderNumber = `${prefix}-${dateStr}-${random}`;

      // 중복 체크
      const existing = await this.findByOrderNumber(orderNumber);
      exists = !!existing;
    }

    return orderNumber!;
  }
}
