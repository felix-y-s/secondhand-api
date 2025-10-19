import { PartialType } from '@nestjs/swagger';
import { CreateCategoryDto } from './create-category.dto';

/**
 * 카테고리 수정 DTO
 * - CreateCategoryDto의 모든 필드를 선택사항으로 변경
 */
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
