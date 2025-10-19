import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderDto, QueryOrdersDto } from './dto';
import { JwtAuthGuard } from '@/common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/auth/guards/roles.guard';
import { Roles } from '@/common/auth/decorators/roles.decorator';
import { Role } from '@/common/auth/enums/role.enum';

/**
 * Orders Controller
 * 주문 관련 HTTP 요청 처리
 */
@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(ClassSerializerInterceptor)
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * 주문 생성
   */
  @Post()
  @ApiOperation({ summary: '주문 생성', description: '새로운 주문을 생성합니다' })
  @ApiResponse({ status: 201, description: '주문 생성 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 404, description: '상품을 찾을 수 없음' })
  async create(@Request() req, @Body() createOrderDto: CreateOrderDto) {
    const order = await this.ordersService.create(req.user.userId, createOrderDto);
    return {
      success: true,
      message: '주문이 생성되었습니다',
      data: order,
    };
  }

  /**
   * 구매 주문 목록 조회
   */
  @Get('my-purchases')
  @ApiOperation({
    summary: '내 구매 주문 목록 조회',
    description: '내가 구매한 주문 목록을 조회합니다',
  })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  async getMyPurchases(@Request() req, @Query() queryDto: QueryOrdersDto) {
    const result = await this.ordersService.findAll(
      req.user.userId,
      queryDto,
      'buyer',
    );
    return {
      success: true,
      message: '구매 주문 목록을 조회했습니다',
      ...result,
    };
  }

  /**
   * 판매 주문 목록 조회
   */
  @Get('my-sales')
  @ApiOperation({
    summary: '내 판매 주문 목록 조회',
    description: '내가 판매한 주문 목록을 조회합니다',
  })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  async getMySales(@Request() req, @Query() queryDto: QueryOrdersDto) {
    const result = await this.ordersService.findAll(
      req.user.userId,
      queryDto,
      'seller',
    );
    return {
      success: true,
      message: '판매 주문 목록을 조회했습니다',
      ...result,
    };
  }

  /**
   * 주문 상세 조회
   */
  @Get(':id')
  @ApiOperation({ summary: '주문 상세 조회', description: '주문 상세 정보를 조회합니다' })
  @ApiParam({ name: 'id', description: '주문 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  @ApiResponse({ status: 404, description: '주문을 찾을 수 없음' })
  async findOne(@Request() req, @Param('id') id: string) {
    const order = await this.ordersService.findOne(id, req.user.userId);
    return {
      success: true,
      message: '주문 정보를 조회했습니다',
      data: order,
    };
  }

  /**
   * 주문 정보 수정
   */
  @Patch(':id')
  @ApiOperation({ summary: '주문 정보 수정', description: '주문 정보를 수정합니다' })
  @ApiParam({ name: 'id', description: '주문 ID' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  @ApiResponse({ status: 404, description: '주문을 찾을 수 없음' })
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateOrderDto: UpdateOrderDto,
  ) {
    const order = await this.ordersService.update(
      id,
      req.user.userId,
      updateOrderDto,
    );
    return {
      success: true,
      message: '주문 정보가 수정되었습니다',
      data: order,
    };
  }

  /**
   * 주문 취소
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '주문 취소', description: '주문을 취소합니다' })
  @ApiParam({ name: 'id', description: '주문 ID' })
  @ApiResponse({ status: 200, description: '취소 성공' })
  @ApiResponse({ status: 400, description: '취소할 수 없는 상태' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  @ApiResponse({ status: 404, description: '주문을 찾을 수 없음' })
  async cancel(@Request() req, @Param('id') id: string) {
    const order = await this.ordersService.cancel(id, req.user.userId);
    return {
      success: true,
      message: '주문이 취소되었습니다',
      data: order,
    };
  }

  /**
   * 주문 확정 (구매 확정)
   */
  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '주문 확정', description: '주문을 확정합니다 (구매 확정)' })
  @ApiParam({ name: 'id', description: '주문 ID' })
  @ApiResponse({ status: 200, description: '확정 성공' })
  @ApiResponse({ status: 400, description: '확정할 수 없는 상태' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  @ApiResponse({ status: 404, description: '주문을 찾을 수 없음' })
  async confirm(@Request() req, @Param('id') id: string) {
    const order = await this.ordersService.confirm(id, req.user.userId);
    return {
      success: true,
      message: '주문이 확정되었습니다',
      data: order,
    };
  }

  /**
   * 주문 삭제 (관리자 전용)
   */
  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '주문 삭제 (관리자 전용)', description: '주문을 삭제합니다' })
  @ApiParam({ name: 'id', description: '주문 ID' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 403, description: '권한 없음 (관리자 전용)' })
  @ApiResponse({ status: 404, description: '주문을 찾을 수 없음' })
  async remove(@Param('id') id: string) {
    const order = await this.ordersService.remove(id);
    return {
      success: true,
      message: '주문이 삭제되었습니다',
      data: order,
    };
  }
}
