import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Product, Prisma, ProductStatus } from '@prisma/client';

/**
 * 상품 Repository
 * 데이터베이스 접근 로직 캡슐화
 */
@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 상품 생성
   * @param data 생성할 상품 데이터
   * @returns 생성된 상품
   */
  async create(data: Prisma.ProductCreateInput): Promise<Product> {
    return this.prisma.product.create({ data });
  }

  /**
   * ID로 상품 조회
   * @param id 상품 ID
   * @returns 상품 또는 null
   */
  async findById(id: string): Promise<Product | null> {
    return this.prisma.product.findUnique({
      where: { id },
      include: {
        seller: {
          select: {
            id: true,
            nickname: true,
            profileImage: true,
            rating: true,
            ratingCount: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  /**
   * 상품 목록 조회 (페이지네이션 및 필터링)
   * @param params 조회 파라미터
   * @returns 상품 목록
   */
  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.ProductWhereInput;
    orderBy?: Prisma.ProductOrderByWithRelationInput;
  }): Promise<Product[]> {
    const { skip, take, where, orderBy } = params;
    return this.prisma.product.findMany({
      skip,
      take,
      where,
      orderBy,
      include: {
        seller: {
          select: {
            id: true,
            nickname: true,
            profileImage: true,
            rating: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  /**
   * 상품 수 카운트
   * @param where 조건
   * @returns 상품 수
   */
  async count(where?: Prisma.ProductWhereInput): Promise<number> {
    return this.prisma.product.count({ where });
  }

  /**
   * 상품 정보 수정
   * @param id 상품 ID
   * @param data 수정할 데이터
   * @returns 수정된 상품
   */
  async update(id: string, data: Prisma.ProductUpdateInput): Promise<Product> {
    return this.prisma.product.update({
      where: { id },
      data,
    });
  }

  /**
   * 상품 삭제 (하드 삭제)
   * @param id 상품 ID
   * @returns 삭제된 상품
   */
  async delete(id: string): Promise<Product> {
    return this.prisma.product.delete({
      where: { id },
    });
  }

  /**
   * 상품 소프트 삭제 (status를 DELETED로 변경)
   * @param id 상품 ID
   * @returns 상태 변경된 상품
   */
  async softDelete(id: string): Promise<Product> {
    return this.prisma.product.update({
      where: { id },
      data: { status: ProductStatus.DELETED },
    });
  }

  /**
   * 조회수 증가
   * @param id 상품 ID
   * @returns 업데이트된 상품
   */
  async incrementViewCount(id: string): Promise<Product> {
    return this.prisma.product.update({
      where: { id },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    });
  }

  /**
   * 판매자의 상품 목록 조회
   * @param sellerId 판매자 ID
   * @param params 조회 파라미터
   * @returns 상품 목록
   */
  async findBySeller(
    sellerId: string,
    params?: {
      skip?: number;
      take?: number;
      status?: ProductStatus;
    },
  ): Promise<Product[]> {
    const where: Prisma.ProductWhereInput = {
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
   * 카테고리별 상품 목록 조회
   * @param categoryId 카테고리 ID
   * @param params 조회 파라미터
   * @returns 상품 목록
   */
  async findByCategory(
    categoryId: string,
    params?: {
      skip?: number;
      take?: number;
      status?: ProductStatus;
    },
  ): Promise<Product[]> {
    const where: Prisma.ProductWhereInput = {
      categoryId,
      status: params?.status || ProductStatus.ACTIVE,
    };

    return this.findMany({
      skip: params?.skip,
      take: params?.take,
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 검색어로 상품 검색
   * @param keyword 검색어
   * @param params 조회 파라미터
   * @returns 상품 목록
   */
  async search(
    keyword: string,
    params?: {
      skip?: number;
      take?: number;
      categoryId?: string;
      minPrice?: number;
      maxPrice?: number;
      status?: ProductStatus;
    },
  ): Promise<Product[]> {
    const where: Prisma.ProductWhereInput = {
      AND: [
        // keyword가 있을 때만 OR 조건 추가
        ...(keyword
          ? [
              {
                OR: [
                  { title: { contains: keyword, mode: Prisma.QueryMode.insensitive } },
                  { description: { contains: keyword, mode: Prisma.QueryMode.insensitive } },
                ],
              },
            ]
          : []),
        ...(params?.categoryId ? [{ categoryId: params.categoryId }] : []),
        ...(params?.minPrice ? [{ price: { gte: params.minPrice } }] : []),
        ...(params?.maxPrice ? [{ price: { lte: params.maxPrice } }] : []),
        { status: params?.status || ProductStatus.ACTIVE },
      ],
    };

    return this.findMany({
      skip: params?.skip,
      take: params?.take,
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 위치 기반 상품 검색
   * @param latitude 위도
   * @param longitude 경도
   * @param radiusKm 반경 (km)
   * @param params 조회 파라미터
   * @returns 상품 목록
   */
  async findByLocation(
    latitude: number,
    longitude: number,
    radiusKm: number = 5,
    params?: {
      skip?: number;
      take?: number;
      status?: ProductStatus;
    },
  ): Promise<Product[]> {
    // Haversine 공식 사용한 거리 계산
    // 실제 프로덕션에서는 PostGIS 같은 공간 데이터베이스 확장 사용 권장
    const where: Prisma.ProductWhereInput = {
      latitude: { not: null },
      longitude: { not: null },
      status: params?.status || ProductStatus.ACTIVE,
    };

    const products = await this.findMany({
      skip: params?.skip,
      take: params?.take,
      where,
      orderBy: { createdAt: 'desc' },
    });

    // 거리 필터링 (간단한 구현)
    return products.filter((product) => {
      if (!product.latitude || !product.longitude) return false;
      const distance = this.calculateDistance(
        latitude,
        longitude,
        product.latitude,
        product.longitude,
      );
      return distance <= radiusKm;
    });
  }

  /**
   * 두 지점 간 거리 계산 (Haversine 공식)
   * @param lat1 위도1
   * @param lon1 경도1
   * @param lat2 위도2
   * @param lon2 경도2
   * @returns 거리 (km)
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // 지구 반경 (km)
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * 도를 라디안으로 변환
   * @param deg 도
   * @returns 라디안
   */
  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
