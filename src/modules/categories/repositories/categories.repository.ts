import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

/**
 * Category 데이터 접근 계층
 * - 계층 구조(부모-자식) 지원
 * - Slug 기반 URL 친화적 조회
 */
@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 새 카테고리 생성
   */
  async create(data: Prisma.CategoryCreateInput) {
    return this.prisma.category.create({
      data,
      include: {
        parent: true,
        children: true,
      },
    });
  }

  /**
   * ID로 카테고리 조회
   */
  async findById(id: string, includeChildren = false) {
    return this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: includeChildren,
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
    });
  }

  /**
   * Slug로 카테고리 조회
   */
  async findBySlug(slug: string, includeChildren = false) {
    return this.prisma.category.findUnique({
      where: { slug },
      include: {
        parent: true,
        children: includeChildren,
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
    });
  }

  /**
   * 이름으로 카테고리 조회
   */
  async findByName(name: string) {
    return this.prisma.category.findUnique({
      where: { name },
    });
  }

  /**
   * 전체 카테고리 목록 조회
   */
  async findAll(params?: {
    isActive?: boolean;
    includeChildren?: boolean;
  }) {
    const { isActive, includeChildren = false } = params || {};

    return this.prisma.category.findMany({
      where: isActive !== undefined ? { isActive } : undefined,
      include: {
        parent: true,
        children: includeChildren,
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * 최상위 카테고리 목록 조회 (parentId가 null)
   */
  async findRootCategories(isActive?: boolean) {
    return this.prisma.category.findMany({
      where: {
        parentId: null,
        ...(isActive !== undefined ? { isActive } : {}),
      },
      include: {
        children: {
          where: isActive !== undefined ? { isActive } : undefined,
          include: {
            _count: {
              select: {
                products: true,
                children: true,
              },
            },
          },
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        },
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * 특정 부모 카테고리의 자식 카테고리 조회
   */
  async findChildren(parentId: string, isActive?: boolean) {
    return this.prisma.category.findMany({
      where: {
        parentId,
        ...(isActive !== undefined ? { isActive } : {}),
      },
      include: {
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * 카테고리 트리 구조 조회 (재귀적으로 모든 자식 포함)
   */
  async findTree(isActive?: boolean) {
    // 최상위 카테고리만 조회하고, 재귀적으로 자식을 포함
    const rootCategories = await this.findRootCategories(isActive);

    // 각 루트 카테고리에 대해 재귀적으로 자식 로드
    return Promise.all(
      rootCategories.map(async (root) => {
        return this.loadCategoryWithAllChildren(root.id, isActive);
      }),
    );
  }

  /**
   * 카테고리와 모든 하위 카테고리를 재귀적으로 로드 (헬퍼 메서드)
   */
  private async loadCategoryWithAllChildren(
    categoryId: string,
    isActive?: boolean,
  ): Promise<any> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        parent: true,
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
    });

    if (!category) return null;

    const children = await this.findChildren(categoryId, isActive);
    const childrenWithSubChildren = await Promise.all(
      children.map((child) =>
        this.loadCategoryWithAllChildren(child.id, isActive),
      ),
    );

    return {
      ...category,
      children: childrenWithSubChildren,
    };
  }

  /**
   * 카테고리 정보 수정
   */
  async update(id: string, data: Prisma.CategoryUpdateInput) {
    return this.prisma.category.update({
      where: { id },
      data,
      include: {
        parent: true,
        children: true,
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
    });
  }

  /**
   * 카테고리 삭제 (하드 삭제)
   */
  async delete(id: string) {
    return this.prisma.category.delete({
      where: { id },
    });
  }

  /**
   * 카테고리 비활성화 (소프트 삭제)
   */
  async softDelete(id: string) {
    return this.update(id, { isActive: false });
  }

  /**
   * 카테고리 순서 변경
   */
  async updateOrder(id: string, order: number) {
    return this.update(id, { order });
  }

  /**
   * 카테고리 개수 조회
   */
  async count(params?: { isActive?: boolean; parentId?: string | null }) {
    const { isActive, parentId } = params || {};

    const where: Prisma.CategoryWhereInput = {};

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (parentId !== undefined) {
      where.parentId = parentId;
    }

    return this.prisma.category.count({ where });
  }

  /**
   * Slug 중복 확인
   */
  async existsBySlug(slug: string, excludeId?: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
    });

    if (!category) return false;
    if (excludeId && category.id === excludeId) return false;

    return true;
  }

  /**
   * 이름 중복 확인
   */
  async existsByName(name: string, excludeId?: string) {
    const category = await this.prisma.category.findUnique({
      where: { name },
    });

    if (!category) return false;
    if (excludeId && category.id === excludeId) return false;

    return true;
  }
}
