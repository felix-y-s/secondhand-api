import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard } from '@/common/auth';
import { ApiGetResponses } from '@/common/decorators';
import { AddFavoriteDto } from './dto/add-favorite.dto';
import { QueryFavoritesDto } from './dto/query-favorites.dto';
import { FavoritesListResponseDto, FavoriteItemDto } from './dto/favorite-response.dto';
import { ResponseDto } from '@/common/dto/response.dto';
import { plainToInstance } from 'class-transformer';
import { existFavoriteDto } from './dto/exist-favorite.dto';
import { DeleteFavoriteDto } from './dto/delete-favorite.dto';

@ApiTags('favorites')
@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @ApiGetResponses()
  @ApiOperation({ summary: '찜하기 추가' })
  async addFavorite(
    @CurrentUser('userId') userId: string,
    @Body() dto: AddFavoriteDto,
  ): Promise<FavoriteItemDto> {
    return this.favoritesService.addFavorite(userId, dto.productId);
  }

  @Get()
  @ApiBearerAuth('access-token')
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    default: 1,
    description: '요청 페이지 번호(1 이상)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    default: 10,
    description: '요청 페이지 크기(1 이상)',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    type: String,
    default: 'createdAt',
    description: '정렬 기준 (createdAt, updatedAt)',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    default: 'desc',
    description: '정렬 방식 (asc, desc)',
  })
  @ApiGetResponses()
  @ApiOperation({ summary: '찜목록 조회' })
  async getMyFavorites(
    @CurrentUser('userId') userId: string,
    @Query() query: QueryFavoritesDto,
  ): Promise<FavoritesListResponseDto> {
    const result = await this.favoritesService.list(
      userId,
      query.page,
      query.limit,
      query.order,
      query.sort,
    );

    return plainToInstance(FavoritesListResponseDto, result);
  }

  @Get(':productId/exist')
  @ApiBearerAuth('access-token')
  @ApiGetResponses()
  @ApiOperation({ summary: '찜 여부 확인' })
  async checkFavorites(
    @CurrentUser('userId') userId: string,
    @Param() dto: existFavoriteDto,
  ): Promise<{ isFavorite: boolean }> {
    const isFavorite = await this.favoritesService.checkFavorite(
      userId,
      dto.productId,
    );

    return { isFavorite };
  }

  @Delete(':productId')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '찜 목록 삭제' })
  async removeFavorite(
    @CurrentUser('userId') userId: string,
    @Param() dto: DeleteFavoriteDto,
  ) {
    await this.favoritesService.removeFavorite(userId, dto.productId);
  }
}
