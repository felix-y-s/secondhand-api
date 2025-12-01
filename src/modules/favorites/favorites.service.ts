import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FavoritesRepository } from './repositories/favorites.repository';
import { Favorite } from '@prisma/client';
import { ProductsService } from '../products/products.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class FavoritesService {
  constructor(
    private readonly favoritesRepository: FavoritesRepository,
    private readonly productService: ProductsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 찜하기
   */
  async addFavorite(userId: string, productId: string): Promise<Favorite> {
    // 상품 존재 확인
    const product = await this.productService.findById(productId);
    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다');
    }
    // 본인 상품 확인
    if (product.sellerId === userId) {
      throw new BadRequestException('본인 상품은 찜할 수 없습니다');
    }

    // 중복 확인
    const isExist = await this.favoritesRepository.exist(userId, productId);
    if (isExist) {
      throw new ConflictException('이미 찜한 상품입니다')
    }

    const favorite = await this.favoritesRepository.create(userId, productId);

    // 판매자에게 알림 이벤트 발행
    this.eventEmitter.emit('product.liked', {
      favoriteId: favorite.id,
      productId,
      userId,
      sellerId: product.sellerId,
    })

    return favorite;
  }

  /**
   * 찜 목록 조회
   */
  async list(
    userId: string,
    page: number = 1,
    limit: number = 20,
    order: string = 'createdAt',
    sort: 'DESC' | 'ASC' = 'DESC',
  ): Promise<{
    items: {
      userId: string;
      productId: string;
      id: string;
      createdAt: Date;
    }[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPage: number;
    }
  }> {
    const { items, ...meta } = await this.favoritesRepository.findMany(
      userId,
      page,
      limit,
      order,
      sort,
    );
    return {
      items,
      meta,
    }
  }

  /**
   * 찜하기 여부 확인
   */
  async checkFavorite(userId: string, productId: string): Promise<boolean> {
    return this.favoritesRepository.exist(userId, productId);
  }

  /**
   * 찜하기 삭제
   */
  async removeFavorite(userId: string, productId: string): Promise<void> {
    const { count } = await this.favoritesRepository.delete(userId, productId);
    if (count === 0) {
      throw new NotFoundException('찜한 상품이 아닙니다');
    }
  }
}
