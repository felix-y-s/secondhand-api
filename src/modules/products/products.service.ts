import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Product, ProductStatus } from '@prisma/client';
import { ProductsRepository } from './repositories/products.repository';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SearchProductDto } from './dto/search-product.dto';
import {
  ProductResponseDto,
  ProductListResponseDto,
} from './dto/product-response.dto';

/**
 * 상품 비즈니스 로직 서비스
 */
@Injectable()
export class ProductsService {
  constructor(private readonly productsRepository: ProductsRepository) {}

  /**
   * 상품 등록
   * @param sellerId 판매자 ID
   * @param createProductDto 상품 등록 정보
   * @returns 생성된 상품
   */
  async create(
    sellerId: string,
    createProductDto: CreateProductDto,
  ): Promise<any> {
    // 위도/경도가 하나만 제공된 경우 에러
    if (
      (createProductDto.latitude && !createProductDto.longitude) ||
      (!createProductDto.latitude && createProductDto.longitude)
    ) {
      throw new BadRequestException('위도와 경도는 함께 제공되어야 합니다');
    }

    // 상품 생성
    const product = await this.productsRepository.create({
      title: createProductDto.title,
      description: createProductDto.description,
      price: createProductDto.price,
      condition: createProductDto.condition,
      images: createProductDto.images || [],
      latitude: createProductDto.latitude,
      longitude: createProductDto.longitude,
      location: createProductDto.location,
      seller: {
        connect: { id: sellerId },
      },
      category: {
        connect: { id: createProductDto.categoryId },
      },
    });

    return product;
  }

  /**
   * 상품 상세 조회
   * @param id 상품 ID
   * @returns 상품 정보
   */
  async findById(id: string): Promise<any> {
    const product = await this.productsRepository.findById(id);

    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다');
    }

    // 조회수 증가 (비동기로 처리, 응답에 영향 없음)
    this.productsRepository.incrementViewCount(id).catch(() => {
      // 조회수 증가 실패는 무시
    });

    return product;
  }

  /**
   * 상품 목록 조회
   * @param page 페이지 번호
   * @param limit 페이지당 항목 수
   * @returns 상품 목록
   */
  async findAll(
    page: number = 1,
    limit: number = 20,
  ): Promise<ProductListResponseDto> {
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      this.productsRepository.findMany({
        skip,
        take: limit,
        where: { status: ProductStatus.ACTIVE },
        orderBy: { createdAt: 'desc' },
      }),
      this.productsRepository.count({ status: ProductStatus.ACTIVE }),
    ]);

    return {
      items: products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 상품 검색
   * @param searchDto 검색 조건
   * @returns 검색 결과
   */
  async search(searchDto: SearchProductDto): Promise<ProductListResponseDto> {
    const { page = 1, limit = 20 } = searchDto;
    const skip = (page - 1) * limit;

    let products: Product[];
    let total: number;

    // 위치 기반 검색
    if (searchDto.latitude && searchDto.longitude) {
      products = await this.productsRepository.findByLocation(
        searchDto.latitude,
        searchDto.longitude,
        searchDto.radiusKm || 5,
        {
          skip,
          take: limit,
          status: searchDto.status || ProductStatus.ACTIVE,
        },
      );
      total = products.length;
    }
    // 키워드 검색
    else if (searchDto.keyword) {
      [products, total] = await Promise.all([
        this.productsRepository.search(searchDto.keyword, {
          skip,
          take: limit,
          categoryId: searchDto.categoryId,
          minPrice: searchDto.minPrice,
          maxPrice: searchDto.maxPrice,
          status: searchDto.status || ProductStatus.ACTIVE,
        }),
        this.productsRepository.count({
          AND: [
            {
              OR: [
                {
                  title: {
                    contains: searchDto.keyword,
                    mode: 'insensitive',
                  },
                },
                {
                  description: {
                    contains: searchDto.keyword,
                    mode: 'insensitive',
                  },
                },
              ],
            },
            ...(searchDto.categoryId
              ? [{ categoryId: searchDto.categoryId }]
              : []),
            ...(searchDto.minPrice
              ? [{ price: { gte: searchDto.minPrice } }]
              : []),
            ...(searchDto.maxPrice
              ? [{ price: { lte: searchDto.maxPrice } }]
              : []),
            { status: searchDto.status || ProductStatus.ACTIVE },
          ],
        }),
      ]);
    }
    // 판매자별 조회
    else if (searchDto.sellerId) {
      [products, total] = await Promise.all([
        this.productsRepository.findBySeller(searchDto.sellerId, {
          skip,
          take: limit,
          status: searchDto.status,
        }),
        this.productsRepository.count({
          sellerId: searchDto.sellerId,
          status: searchDto.status,
        }),
      ]);
    }
    // 카테고리별 조회
    else if (searchDto.categoryId) {
      [products, total] = await Promise.all([
        this.productsRepository.findByCategory(searchDto.categoryId, {
          skip,
          take: limit,
          status: searchDto.status || ProductStatus.ACTIVE,
        }),
        this.productsRepository.count({
          categoryId: searchDto.categoryId,
          status: searchDto.status || ProductStatus.ACTIVE,
        }),
      ]);
    }
    // 전체 목록 조회
    else {
      [products, total] = await Promise.all([
        this.productsRepository.findMany({
          skip,
          take: limit,
          where: { status: searchDto.status || ProductStatus.ACTIVE },
          orderBy: { createdAt: 'desc' },
        }),
        this.productsRepository.count({
          status: searchDto.status || ProductStatus.ACTIVE,
        }),
      ]);
    }

    return {
      items: products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 상품 정보 수정
   * @param id 상품 ID
   * @param userId 사용자 ID
   * @param updateProductDto 수정할 정보
   * @returns 수정된 상품
   */
  async update(
    id: string,
    userId: string,
    updateProductDto: UpdateProductDto,
  ): Promise<any> {
    const product = await this.productsRepository.findById(id);

    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다');
    }

    // 판매자 본인 확인
    if (product.sellerId !== userId) {
      throw new ForbiddenException('본인의 상품만 수정할 수 있습니다');
    }

    // 삭제된 상품은 수정 불가
    if (product.status === ProductStatus.DELETED) {
      throw new BadRequestException('삭제된 상품은 수정할 수 없습니다');
    }

    // 위도/경도 검증
    if (
      (updateProductDto.latitude && !updateProductDto.longitude) ||
      (!updateProductDto.latitude && updateProductDto.longitude)
    ) {
      throw new BadRequestException('위도와 경도는 함께 제공되어야 합니다');
    }

    // 상품 정보 수정
    const updatedProduct = await this.productsRepository.update(id, {
      ...(updateProductDto.title && { title: updateProductDto.title }),
      ...(updateProductDto.description && {
        description: updateProductDto.description,
      }),
      ...(updateProductDto.price !== undefined && {
        price: updateProductDto.price,
      }),
      ...(updateProductDto.condition && {
        condition: updateProductDto.condition,
      }),
      ...(updateProductDto.status && { status: updateProductDto.status }),
      ...(updateProductDto.images && { images: updateProductDto.images }),
      ...(updateProductDto.latitude !== undefined && {
        latitude: updateProductDto.latitude,
      }),
      ...(updateProductDto.longitude !== undefined && {
        longitude: updateProductDto.longitude,
      }),
      ...(updateProductDto.location !== undefined && {
        location: updateProductDto.location,
      }),
      ...(updateProductDto.categoryId && {
        category: { connect: { id: updateProductDto.categoryId } },
      }),
    });

    return updatedProduct;
  }

  /**
   * 상품 삭제 (소프트 삭제)
   * @param id 상품 ID
   * @param userId 사용자 ID
   * @returns 삭제된 상품
   */
  async remove(id: string, userId: string): Promise<any> {
    const product = await this.productsRepository.findById(id);

    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다');
    }

    // 판매자 본인 확인
    if (product.sellerId !== userId) {
      throw new ForbiddenException('본인의 상품만 삭제할 수 있습니다');
    }

    // 이미 삭제된 상품
    if (product.status === ProductStatus.DELETED) {
      throw new BadRequestException('이미 삭제된 상품입니다');
    }

    // 소프트 삭제
    return this.productsRepository.softDelete(id);
  }

  /**
   * 내 상품 목록 조회
   * @param userId 사용자 ID
   * @param page 페이지 번호
   * @param limit 페이지당 항목 수
   * @param status 상품 상태 필터
   * @returns 상품 목록
   */
  async findMyProducts(
    userId: string,
    page: number = 1,
    limit: number = 20,
    status?: ProductStatus,
  ): Promise<ProductListResponseDto> {
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      this.productsRepository.findBySeller(userId, {
        skip,
        take: limit,
        status,
      }),
      this.productsRepository.count({
        sellerId: userId,
        ...(status && { status }),
      }),
    ]);

    return {
      items: products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 상품 존재 유무 확인
   * @param productId 상품 아이디
   * @throws NotFoundException - 상품을 찾을 수 없는 경우
   */
  async ensureProductExists(productId: string): Promise<void> {
    const product = await this.productsRepository.findById(productId);

    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다');
    }
  }
}
