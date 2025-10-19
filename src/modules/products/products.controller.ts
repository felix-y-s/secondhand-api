import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SearchProductDto } from './dto/search-product.dto';
import {
  ProductResponseDto,
  ProductListResponseDto,
} from './dto/product-response.dto';
import { JwtAuthGuard } from '@/common/auth/guards/jwt-auth.guard';
import { Public } from '@/common/auth/decorators/public.decorator';
import { CurrentUser } from '@/common/auth/decorators/current-user.decorator';
import type { JwtValidationResult } from '@/common/auth/interfaces/jwt-payload.interface';
import { ResponseDto } from '@/common/dto/response.dto';
import { ApiGetResponses } from '@/common/decorators/api-responses.decorator';
import { ProductStatus } from '@prisma/client';

/**
 * 상품 API 컨트롤러
 */
@ApiTags('Products')
@Controller('products')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * 상품 등록
   */
  @Post()
  @ApiBearerAuth()
  @ApiOperation({
    summary: '상품 등록',
    description: '새로운 상품을 등록합니다.',
  })
  @ApiCreatedResponse({
    description: '상품 등록 성공',
    type: ProductResponseDto,
  })
  @ApiBadRequestResponse({ description: '잘못된 요청 (유효성 검증 실패)' })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async create(
    @CurrentUser() user: JwtValidationResult,
    @Body() createProductDto: CreateProductDto,
  ): Promise<ResponseDto<ProductResponseDto>> {
    const product = await this.productsService.create(
      user.userId,
      createProductDto,
    );

    return {
      success: true,
      data: product,
      message: '상품이 성공적으로 등록되었습니다',
    };
  }

  /**
   * 상품 목록 조회
   */
  @Public()
  @Get()
  @ApiOperation({
    summary: '상품 목록 조회',
    description: '활성 상태의 상품 목록을 페이지네이션으로 조회합니다.',
  })
  @ApiOkResponse({
    description: '상품 목록 조회 성공',
    type: ProductListResponseDto,
  })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<ResponseDto<ProductListResponseDto>> {
    const result = await this.productsService.findAll(page, limit);

    return {
      success: true,
      data: result,
      message: '상품 목록 조회 성공',
    };
  }

  /**
   * 상품 검색
   */
  @Public()
  @Get('search')
  @ApiOperation({
    summary: '상품 검색',
    description:
      '키워드, 카테고리, 가격대, 위치 등 다양한 조건으로 상품을 검색합니다.',
  })
  @ApiOkResponse({
    description: '상품 검색 성공',
    type: ProductListResponseDto,
  })
  async search(
    @Query() searchDto: SearchProductDto,
  ): Promise<ResponseDto<ProductListResponseDto>> {
    const result = await this.productsService.search(searchDto);

    return {
      success: true,
      data: result,
      message: '상품 검색 성공',
    };
  }

  /**
   * 내 상품 목록 조회
   */
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '내 상품 목록 조회',
    description: '현재 로그인한 사용자가 등록한 상품 목록을 조회합니다.',
  })
  @ApiOkResponse({
    description: '내 상품 목록 조회 성공',
    type: ProductListResponseDto,
  })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async findMyProducts(
    @CurrentUser() user: JwtValidationResult,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: ProductStatus,
  ): Promise<ResponseDto<ProductListResponseDto>> {
    const result = await this.productsService.findMyProducts(
      user.userId,
      page,
      limit,
      status,
    );

    return {
      success: true,
      data: result,
      message: '내 상품 목록 조회 성공',
    };
  }

  /**
   * 상품 상세 조회
   */
  @Public()
  @Get(':id')
  @ApiOperation({
    summary: '상품 상세 조회',
    description: '특정 상품의 상세 정보를 조회합니다. 조회수가 자동으로 증가합니다.',
  })
  @ApiOkResponse({
    description: '상품 상세 조회 성공',
    type: ProductResponseDto,
  })
  @ApiNotFoundResponse({ description: '상품을 찾을 수 없음' })
  async findOne(
    @Param('id') id: string,
  ): Promise<ResponseDto<ProductResponseDto>> {
    const product = await this.productsService.findById(id);

    return {
      success: true,
      data: product,
      message: '상품 조회 성공',
    };
  }

  /**
   * 상품 정보 수정
   */
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '상품 정보 수정',
    description: '본인이 등록한 상품의 정보를 수정합니다.',
  })
  @ApiOkResponse({
    description: '상품 정보 수정 성공',
    type: ProductResponseDto,
  })
  @ApiBadRequestResponse({ description: '잘못된 요청 (유효성 검증 실패)' })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  @ApiForbiddenResponse({ description: '권한 없음 (본인의 상품이 아님)' })
  @ApiNotFoundResponse({ description: '상품을 찾을 수 없음' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: JwtValidationResult,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<ResponseDto<ProductResponseDto>> {
    const product = await this.productsService.update(
      id,
      user.userId,
      updateProductDto,
    );

    return {
      success: true,
      data: product,
      message: '상품 정보가 성공적으로 수정되었습니다',
    };
  }

  /**
   * 상품 삭제
   */
  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '상품 삭제',
    description: '본인이 등록한 상품을 삭제합니다 (소프트 삭제).',
  })
  @ApiOkResponse({
    description: '상품 삭제 성공',
    type: ProductResponseDto,
  })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  @ApiForbiddenResponse({ description: '권한 없음 (본인의 상품이 아님)' })
  @ApiNotFoundResponse({ description: '상품을 찾을 수 없음' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtValidationResult,
  ): Promise<ResponseDto<ProductResponseDto>> {
    const product = await this.productsService.remove(id, user.userId);

    return {
      success: true,
      data: product,
      message: '상품이 성공적으로 삭제되었습니다',
    };
  }
}
