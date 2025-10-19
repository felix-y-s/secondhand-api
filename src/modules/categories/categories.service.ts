import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { CategoriesRepository } from './repositories/categories.repository';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryResponseDto,
} from './dto';

/**
 * Category 비즈니스 로직
 */
@Injectable()
export class CategoriesService {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

  /**
   * 새 카테고리 생성
   */
  async create(createCategoryDto: CreateCategoryDto): Promise<CategoryResponseDto> {
    const { name, slug, parentId, ...rest } = createCategoryDto;

    // 이름 중복 검사
    const existingName = await this.categoriesRepository.existsByName(name);
    if (existingName) {
      throw new ConflictException('이미 존재하는 카테고리 이름입니다');
    }

    // Slug 중복 검사
    const existingSlug = await this.categoriesRepository.existsBySlug(slug);
    if (existingSlug) {
      throw new ConflictException('이미 사용 중인 슬러그입니다');
    }

    // 부모 카테고리 존재 여부 확인
    if (parentId) {
      const parentCategory = await this.categoriesRepository.findById(parentId);
      if (!parentCategory) {
        throw new NotFoundException('부모 카테고리를 찾을 수 없습니다');
      }
      if (!parentCategory.isActive) {
        throw new BadRequestException('비활성화된 부모 카테고리에는 자식을 추가할 수 없습니다');
      }
    }

    const category = await this.categoriesRepository.create({
      name,
      slug,
      parent: parentId ? { connect: { id: parentId } } : undefined,
      ...rest,
    });

    return new CategoryResponseDto(category);
  }

  /**
   * ID로 카테고리 조회
   */
  async findOne(id: string, includeChildren = false): Promise<CategoryResponseDto> {
    const category = await this.categoriesRepository.findById(id, includeChildren);

    if (!category) {
      throw new NotFoundException('카테고리를 찾을 수 없습니다');
    }

    return new CategoryResponseDto(category);
  }

  /**
   * Slug로 카테고리 조회
   */
  async findBySlug(slug: string, includeChildren = false): Promise<CategoryResponseDto> {
    const category = await this.categoriesRepository.findBySlug(slug, includeChildren);

    if (!category) {
      throw new NotFoundException('카테고리를 찾을 수 없습니다');
    }

    return new CategoryResponseDto(category);
  }

  /**
   * 전체 카테고리 목록 조회
   */
  async findAll(params?: {
    isActive?: boolean;
    includeChildren?: boolean;
  }): Promise<CategoryResponseDto[]> {
    const categories = await this.categoriesRepository.findAll(params);
    return categories.map((category) => new CategoryResponseDto(category));
  }

  /**
   * 최상위 카테고리 목록 조회
   */
  async findRootCategories(isActive?: boolean): Promise<CategoryResponseDto[]> {
    const categories = await this.categoriesRepository.findRootCategories(isActive);
    return categories.map((category) => new CategoryResponseDto(category));
  }

  /**
   * 특정 카테고리의 자식 목록 조회
   */
  async findChildren(parentId: string, isActive?: boolean): Promise<CategoryResponseDto[]> {
    // 부모 카테고리 존재 여부 확인
    const parentCategory = await this.categoriesRepository.findById(parentId);
    if (!parentCategory) {
      throw new NotFoundException('부모 카테고리를 찾을 수 없습니다');
    }

    const children = await this.categoriesRepository.findChildren(parentId, isActive);
    return children.map((child) => new CategoryResponseDto(child));
  }

  /**
   * 카테고리 트리 구조 조회 (전체 계층)
   */
  async findTree(isActive?: boolean): Promise<CategoryResponseDto[]> {
    const tree = await this.categoriesRepository.findTree(isActive);
    return tree.map((category) => new CategoryResponseDto(category));
  }

  /**
   * 카테고리 수정
   */
  async update(id: string, updateCategoryDto: UpdateCategoryDto): Promise<CategoryResponseDto> {
    const { name, slug, parentId, ...rest } = updateCategoryDto;

    // 카테고리 존재 여부 확인
    const existingCategory = await this.categoriesRepository.findById(id);
    if (!existingCategory) {
      throw new NotFoundException('카테고리를 찾을 수 없습니다');
    }

    // 이름 중복 검사 (다른 카테고리와 중복)
    if (name && name !== existingCategory.name) {
      const nameExists = await this.categoriesRepository.existsByName(name, id);
      if (nameExists) {
        throw new ConflictException('이미 존재하는 카테고리 이름입니다');
      }
    }

    // Slug 중복 검사 (다른 카테고리와 중복)
    if (slug && slug !== existingCategory.slug) {
      const slugExists = await this.categoriesRepository.existsBySlug(slug, id);
      if (slugExists) {
        throw new ConflictException('이미 사용 중인 슬러그입니다');
      }
    }

    // 부모 카테고리 검증
    if (parentId !== undefined) {
      // null로 변경하는 경우 (최상위 카테고리로 변경)
      if (parentId === null) {
        // 허용
      } else {
        // 새로운 부모 카테고리 지정
        if (parentId === id) {
          throw new BadRequestException('자기 자신을 부모 카테고리로 설정할 수 없습니다');
        }

        const parentCategory = await this.categoriesRepository.findById(parentId);
        if (!parentCategory) {
          throw new NotFoundException('부모 카테고리를 찾을 수 없습니다');
        }

        if (!parentCategory.isActive) {
          throw new BadRequestException('비활성화된 부모 카테고리에는 자식을 추가할 수 없습니다');
        }

        // 순환 참조 방지: 자신의 자식을 부모로 설정하는 것 방지
        const isDescendant = await this.isDescendant(id, parentId);
        if (isDescendant) {
          throw new BadRequestException('하위 카테고리를 부모로 설정할 수 없습니다 (순환 참조)');
        }
      }
    }

    const updateData: any = { ...rest };
    if (name) updateData.name = name;
    if (slug) updateData.slug = slug;

    if (parentId !== undefined) {
      if (parentId === null) {
        updateData.parent = { disconnect: true };
      } else {
        updateData.parent = { connect: { id: parentId } };
      }
    }

    const category = await this.categoriesRepository.update(id, updateData);
    return new CategoryResponseDto(category);
  }

  /**
   * 카테고리 삭제 (Hard Delete)
   */
  async remove(id: string): Promise<void> {
    const category = await this.categoriesRepository.findById(id, true);

    if (!category) {
      throw new NotFoundException('카테고리를 찾을 수 없습니다');
    }

    // 자식 카테고리가 있는 경우 삭제 불가
    if (category.children && category.children.length > 0) {
      throw new BadRequestException('하위 카테고리가 있는 카테고리는 삭제할 수 없습니다');
    }

    // 상품이 있는 경우 삭제 불가
    if (category._count && category._count.products > 0) {
      throw new BadRequestException('상품이 등록된 카테고리는 삭제할 수 없습니다');
    }

    // Hard Delete
    await this.categoriesRepository.delete(id);
  }

  /**
   * 카테고리 순서 변경
   */
  async updateOrder(id: string, order: number): Promise<CategoryResponseDto> {
    const category = await this.categoriesRepository.findById(id);

    if (!category) {
      throw new NotFoundException('카테고리를 찾을 수 없습니다');
    }

    const updated = await this.categoriesRepository.updateOrder(id, order);
    return new CategoryResponseDto(updated);
  }

  /**
   * 순환 참조 확인: targetId가 categoryId의 하위 카테고리인지 확인
   */
  private async isDescendant(categoryId: string, targetId: string): Promise<boolean> {
    const children = await this.categoriesRepository.findChildren(categoryId);

    for (const child of children) {
      if (child.id === targetId) {
        return true;
      }
      // 재귀적으로 자식의 자식도 확인
      const isChildDescendant = await this.isDescendant(child.id, targetId);
      if (isChildDescendant) {
        return true;
      }
    }

    return false;
  }
}
