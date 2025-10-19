import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { OrdersRepository } from './repositories/orders.repository';
import { ProductsRepository } from '../products/repositories/products.repository';
import { CreateOrderDto, UpdateOrderDto, QueryOrdersDto } from './dto';
import { Order, OrderStatus, ProductStatus } from '@prisma/client';

/**
 * 주문 Service
 * 비즈니스 로직 처리
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly productsRepository: ProductsRepository,
  ) {}

  /**
   * 주문 생성
   * @param buyerId 구매자 ID
   * @param createOrderDto 주문 생성 DTO
   * @returns 생성된 주문
   */
  async create(buyerId: string, createOrderDto: CreateOrderDto): Promise<Order> {
    const { productId, totalAmount, shippingFee = 0, ...rest } = createOrderDto;

    // 상품 존재 여부 및 판매 가능 상태 확인
    const product = await this.productsRepository.findById(productId);
    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다');
    }

    if (product.status !== ProductStatus.ACTIVE) {
      throw new BadRequestException('판매 중인 상품이 아닙니다');
    }

    // 자기 자신의 상품은 구매할 수 없음
    if (product.sellerId === buyerId) {
      throw new BadRequestException('자신의 상품은 구매할 수 없습니다');
    }

    // 주문 번호 생성
    const orderNumber = await this.ordersRepository.generateOrderNumber();

    // 주문 생성
    const order = await this.ordersRepository.create({
      orderNumber,
      totalAmount,
      shippingFee,
      buyer: { connect: { id: buyerId } },
      seller: { connect: { id: product.sellerId } },
      product: { connect: { id: productId } },
      ...rest,
    });

    // 상품 상태를 RESERVED로 변경
    await this.productsRepository.update(productId, {
      status: ProductStatus.RESERVED,
    });

    return order;
  }

  /**
   * ID로 주문 조회
   * @param id 주문 ID
   * @param userId 현재 사용자 ID
   * @returns 주문 정보
   */
  async findOne(id: string, userId: string): Promise<Order> {
    const order = await this.ordersRepository.findById(id);
    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다');
    }

    // 구매자 또는 판매자만 조회 가능
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ForbiddenException('주문 정보에 접근할 수 없습니다');
    }

    return order;
  }

  /**
   * 주문 목록 조회
   * @param userId 현재 사용자 ID
   * @param queryDto 조회 옵션
   * @param role 사용자 역할 ('buyer' | 'seller')
   * @returns 주문 목록 및 메타데이터
   */
  async findAll(
    userId: string,
    queryDto: QueryOrdersDto,
    role: 'buyer' | 'seller' = 'buyer',
  ) {
    const { page = 1, limit = 20, status } = queryDto;
    const skip = (page - 1) * limit;

    // 역할에 따라 다른 메서드 호출
    const orders =
      role === 'buyer'
        ? await this.ordersRepository.findByBuyer(userId, {
            skip,
            take: limit,
            status,
          })
        : await this.ordersRepository.findBySeller(userId, {
            skip,
            take: limit,
            status,
          });

    const total = await this.ordersRepository.count({
      [role === 'buyer' ? 'buyerId' : 'sellerId']: userId,
      ...(status && { status }),
    });

    return {
      data: orders,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 주문 정보 수정
   * @param id 주문 ID
   * @param userId 현재 사용자 ID
   * @param updateOrderDto 수정 DTO
   * @returns 수정된 주문
   */
  async update(
    id: string,
    userId: string,
    updateOrderDto: UpdateOrderDto,
  ): Promise<Order> {
    const order = await this.ordersRepository.findById(id);
    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다');
    }

    // 구매자 또는 판매자만 수정 가능
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ForbiddenException('주문 정보를 수정할 수 없습니다');
    }

    // 상태 변경 검증
    if (updateOrderDto.status) {
      this.validateStatusTransition(order.status, updateOrderDto.status, userId, order);
    }

    return this.ordersRepository.update(id, updateOrderDto);
  }

  /**
   * 주문 취소
   * @param id 주문 ID
   * @param userId 현재 사용자 ID
   * @returns 취소된 주문
   */
  async cancel(id: string, userId: string): Promise<Order> {
    const order = await this.ordersRepository.findById(id);
    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다');
    }

    // 구매자만 취소 가능
    if (order.buyerId !== userId) {
      throw new ForbiddenException('주문을 취소할 수 없습니다');
    }

    // 취소 가능한 상태 확인
    const cancellableStatuses: OrderStatus[] = [
      OrderStatus.PENDING,
      OrderStatus.PAYMENT_PENDING,
      OrderStatus.PAID,
    ];
    if (!cancellableStatuses.includes(order.status)) {
      throw new BadRequestException('취소할 수 없는 주문 상태입니다');
    }

    // 주문 취소 및 상품 상태 복원
    const cancelledOrder = await this.ordersRepository.updateStatus(
      id,
      OrderStatus.CANCELLED,
    );

    await this.productsRepository.update(order.productId, {
      status: ProductStatus.ACTIVE,
    });

    return cancelledOrder;
  }

  /**
   * 주문 확정 (구매 확정)
   * @param id 주문 ID
   * @param userId 현재 사용자 ID
   * @returns 확정된 주문
   */
  async confirm(id: string, userId: string): Promise<Order> {
    const order = await this.ordersRepository.findById(id);
    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다');
    }

    // 구매자만 확정 가능
    if (order.buyerId !== userId) {
      throw new ForbiddenException('주문을 확정할 수 없습니다');
    }

    // 확정 가능한 상태 확인
    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('확정할 수 없는 주문 상태입니다');
    }

    // 주문 확정 및 상품 상태 변경
    const confirmedOrder = await this.ordersRepository.updateStatus(
      id,
      OrderStatus.CONFIRMED,
    );

    await this.productsRepository.update(order.productId, {
      status: ProductStatus.SOLD,
      soldAt: new Date(),
    });

    return confirmedOrder;
  }

  /**
   * 주문 상태 전환 검증
   * @param currentStatus 현재 상태
   * @param newStatus 새 상태
   * @param userId 사용자 ID
   * @param order 주문 객체
   */
  private validateStatusTransition(
    currentStatus: OrderStatus,
    newStatus: OrderStatus,
    userId: string,
    order: Order,
  ): void {
    // 구매자 권한 검증
    const isBuyer = order.buyerId === userId;
    const isSeller = order.sellerId === userId;

    // 상태별 전환 규칙
    const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.PAYMENT_PENDING, OrderStatus.CANCELLED],
      [OrderStatus.PAYMENT_PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
      [OrderStatus.PAID]: [OrderStatus.SHIPPING, OrderStatus.REFUNDED],
      [OrderStatus.SHIPPING]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [OrderStatus.CONFIRMED, OrderStatus.REFUNDED],
      [OrderStatus.CONFIRMED]: [],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.REFUNDED]: [],
    };

    // 허용된 전환인지 확인
    const allowed = allowedTransitions[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `${currentStatus}에서 ${newStatus}로 변경할 수 없습니다`,
      );
    }

    // 역할별 권한 확인
    const sellerOnlyStatus: OrderStatus[] = [OrderStatus.SHIPPING, OrderStatus.DELIVERED];
    const buyerOnlyStatus: OrderStatus[] = [OrderStatus.CONFIRMED, OrderStatus.CANCELLED];

    if (sellerOnlyStatus.includes(newStatus) && !isSeller) {
      throw new ForbiddenException('판매자만 이 상태로 변경할 수 있습니다');
    }

    if (buyerOnlyStatus.includes(newStatus) && !isBuyer) {
      throw new ForbiddenException('구매자만 이 상태로 변경할 수 있습니다');
    }
  }

  /**
   * 주문 삭제 (관리자 전용)
   * @param id 주문 ID
   * @returns 삭제된 주문
   */
  async remove(id: string): Promise<Order> {
    const order = await this.ordersRepository.findById(id);
    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다');
    }

    return this.ordersRepository.delete(id);
  }
}
