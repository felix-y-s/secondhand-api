import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  ClassSerializerInterceptor,
  ParseBoolPipe,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryResponseDto,
} from './dto';
import { ResponseDto } from '@/common/dto/response.dto';
import { Public, Roles, JwtAuthGuard, RolesGuard, Role } from '@/modules/auth';

/**
 * 카테고리 API 컨트롤러
 * - 계층 구조 지원 (부모-자식)
 * - 공개 API (조회) / 관리자 전용 API (생성, 수정, 삭제)
 */
@ApiTags('categories')
@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /**
   * 새 카테고리 생성 (관리자 전용)
   */
  @Post()
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '카테고리 생성',
    description: '새로운 카테고리를 생성합니다. 관리자 권한이 필요합니다.',
  })
  @ApiResponse({
    status: 201,
    description: '카테고리 생성 성공',
    type: CategoryResponseDto,
  })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 403, description: '권한 없음 (관리자 전용)' })
  @ApiResponse({ status: 409, description: '이름 또는 슬러그 중복' })
  async create(@Body() createCategoryDto: CreateCategoryDto) {
    const category = await this.categoriesService.create(createCategoryDto);
    return ResponseDto.success(category, '카테고리가 생성되었습니다');
  }

  /**
   * 전체 카테고리 목록 조회 (공개)
   */
  @Get()
  @Public()
  @ApiOperation({
    summary: '전체 카테고리 목록 조회',
    description: '모든 카테고리를 조회합니다.',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: '활성화 상태 필터 (true: 활성만, false: 비활성만, 미지정: 전체)',
  })
  @ApiQuery({
    name: 'includeChildren',
    required: false,
    type: Boolean,
    description: '하위 카테고리 포함 여부',
  })
  @ApiResponse({
    status: 200,
    description: '카테고리 목록 조회 성공',
    type: [CategoryResponseDto],
  })
  async findAll(
    @Query('isActive', new ParseBoolPipe({ optional: true })) isActive?: boolean,
    @Query('includeChildren', new ParseBoolPipe({ optional: true }))
    includeChildren?: boolean,
  ) {
    const categories = await this.categoriesService.findAll({
      isActive,
      includeChildren,
    });
    return ResponseDto.success(categories, '카테고리 목록 조회 성공');
  }

  /**
   * 카테고리 트리 구조 조회 (공개)
   */
  @Get('tree')
  @Public()
  @ApiOperation({
    summary: '카테고리 트리 구조 조회',
    description: '최상위 카테고리부터 모든 하위 카테고리를 포함한 전체 트리 구조를 조회합니다.',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: '활성화 상태 필터',
  })
  @ApiResponse({
    status: 200,
    description: '카테고리 트리 조회 성공',
    type: [CategoryResponseDto],
  })
  async findTree(
    @Query('isActive', new ParseBoolPipe({ optional: true })) isActive?: boolean,
  ) {
    const tree = await this.categoriesService.findTree(isActive);
    return ResponseDto.success(tree, '카테고리 트리 조회 성공');
  }

  /**
   * 최상위 카테고리 목록 조회 (공개)
   */
  @Get('roots')
  @Public()
  @ApiOperation({
    summary: '최상위 카테고리 목록 조회',
    description: '부모가 없는 최상위 카테고리만 조회합니다.',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: '활성화 상태 필터',
  })
  @ApiResponse({
    status: 200,
    description: '최상위 카테고리 목록 조회 성공',
    type: [CategoryResponseDto],
  })
  async findRoots(
    @Query('isActive', new ParseBoolPipe({ optional: true })) isActive?: boolean,
  ) {
    const categories = await this.categoriesService.findRootCategories(isActive);
    return ResponseDto.success(categories, '최상위 카테고리 목록 조회 성공');
  }

  /**
   * Slug로 카테고리 조회 (공개)
   */
  @Get('slug/:slug')
  @Public()
  @ApiOperation({
    summary: 'Slug로 카테고리 조회',
    description: 'URL 친화적 슬러그로 카테고리를 조회합니다.',
  })
  @ApiParam({ name: 'slug', description: '카테고리 슬러그', example: 'electronics' })
  @ApiQuery({
    name: 'includeChildren',
    required: false,
    type: Boolean,
    description: '하위 카테고리 포함 여부',
  })
  @ApiResponse({
    status: 200,
    description: '카테고리 조회 성공',
    type: CategoryResponseDto,
  })
  @ApiResponse({ status: 404, description: '카테고리를 찾을 수 없음' })
  async findBySlug(
    @Param('slug') slug: string,
    @Query('includeChildren', new ParseBoolPipe({ optional: true }))
    includeChildren?: boolean,
  ) {
    const category = await this.categoriesService.findBySlug(slug, includeChildren);
    return ResponseDto.success(category, '카테고리 조회 성공');
  }

  /**
   * ID로 카테고리 조회 (공개)
   */
  @Get(':id')
  @Public()
  @ApiOperation({
    summary: 'ID로 카테고리 조회',
    description: 'UUID로 특정 카테고리를 조회합니다.',
  })
  @ApiParam({ name: 'id', description: '카테고리 ID (UUID)' })
  @ApiQuery({
    name: 'includeChildren',
    required: false,
    type: Boolean,
    description: '하위 카테고리 포함 여부',
  })
  @ApiResponse({
    status: 200,
    description: '카테고리 조회 성공',
    type: CategoryResponseDto,
  })
  @ApiResponse({ status: 404, description: '카테고리를 찾을 수 없음' })
  async findOne(
    @Param('id') id: string,
    @Query('includeChildren', new ParseBoolPipe({ optional: true }))
    includeChildren?: boolean,
  ) {
    const category = await this.categoriesService.findOne(id, includeChildren);
    return ResponseDto.success(category, '카테고리 조회 성공');
  }

  /**
   * 특정 카테고리의 하위 카테고리 조회 (공개)
   */
  @Get(':id/children')
  @Public()
  @ApiOperation({
    summary: '하위 카테고리 목록 조회',
    description: '특정 카테고리의 직속 자식 카테고리만 조회합니다.',
  })
  @ApiParam({ name: 'id', description: '부모 카테고리 ID (UUID)' })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: '활성화 상태 필터',
  })
  @ApiResponse({
    status: 200,
    description: '하위 카테고리 목록 조회 성공',
    type: [CategoryResponseDto],
  })
  @ApiResponse({ status: 404, description: '부모 카테고리를 찾을 수 없음' })
  async findChildren(
    @Param('id') id: string,
    @Query('isActive', new ParseBoolPipe({ optional: true })) isActive?: boolean,
  ) {
    const children = await this.categoriesService.findChildren(id, isActive);
    return ResponseDto.success(children, '하위 카테고리 목록 조회 성공');
  }

  /**
   * 카테고리 정보 수정 (관리자 전용)
   */
  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '카테고리 수정',
    description: '카테고리 정보를 수정합니다. 관리자 권한이 필요합니다.',
  })
  @ApiParam({ name: 'id', description: '카테고리 ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: '카테고리 수정 성공',
    type: CategoryResponseDto,
  })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 403, description: '권한 없음 (관리자 전용)' })
  @ApiResponse({ status: 404, description: '카테고리를 찾을 수 없음' })
  @ApiResponse({ status: 409, description: '이름 또는 슬러그 중복' })
  async update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    const category = await this.categoriesService.update(id, updateCategoryDto);
    return ResponseDto.success(category, '카테고리가 수정되었습니다');
  }

  /**
   * 카테고리 순서 변경 (관리자 전용)
   */
  @Patch(':id/order')
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '카테고리 순서 변경',
    description: '카테고리의 표시 순서를 변경합니다. 관리자 권한이 필요합니다.',
  })
  @ApiParam({ name: 'id', description: '카테고리 ID (UUID)' })
  @ApiQuery({ name: 'order', type: Number, description: '새로운 순서 (정수)' })
  @ApiResponse({
    status: 200,
    description: '카테고리 순서 변경 성공',
    type: CategoryResponseDto,
  })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 403, description: '권한 없음 (관리자 전용)' })
  @ApiResponse({ status: 404, description: '카테고리를 찾을 수 없음' })
  async updateOrder(
    @Param('id') id: string,
    @Query('order', ParseIntPipe) order: number,
  ) {
    const category = await this.categoriesService.updateOrder(id, order);
    return ResponseDto.success(category, '카테고리 순서가 변경되었습니다');
  }

  /**
   * 카테고리 삭제 (Soft Delete, 관리자 전용)
   */
  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '카테고리 삭제',
    description: '카테고리를 삭제합니다 (Soft Delete). 하위 카테고리나 상품이 있으면 삭제할 수 없습니다. 관리자 권한이 필요합니다.',
  })
  @ApiParam({ name: 'id', description: '카테고리 ID (UUID)' })
  @ApiResponse({ status: 204, description: '카테고리 삭제 성공 (No Content)' })
  @ApiResponse({ status: 400, description: '하위 카테고리 또는 상품이 존재함' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 403, description: '권한 없음 (관리자 전용)' })
  @ApiResponse({ status: 404, description: '카테고리를 찾을 수 없음' })
  async remove(@Param('id') id: string) {
    await this.categoriesService.remove(id);
  }
}
