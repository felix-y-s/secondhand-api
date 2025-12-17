import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { DeleteResult, Model } from 'mongoose';
import { ProductDetail } from './schemas/product-detail.schema';
import { Message } from '@/modules/messages-mongo/schemas';

/**
 * MongoDB 테스트용 서비스
 * ProductDetail과 Message 스키마에 대한 CRUD 작업
 */
@Injectable()
export class MongodbService {
  constructor(
    @InjectModel(ProductDetail.name)
    private productDetailModel: Model<ProductDetail>,
    @InjectModel(Message.name)
    private messageModel: Model<Message>,
  ) {}

  /**
   * MongoDB 연결 상태 확인
   *
   * @returns 연결 여부
   */
  async isConnected(): Promise<boolean> {
    try {
      const state = this.productDetailModel.db.readyState;
      // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
      return state === 1;
    } catch (error) {
      return false;
    }
  }

  // ===== ProductDetail CRUD =====

  /**
   * 상품 상세 정보 생성
   */
  async createProductDetail(data: {
    productId: number;
    description: string;
    images?: { url: string; alt: string; order: number }[];
    specifications?: {
      brand?: string;
      condition?: string;
      location?: {
        city: string;
        district: string;
        coordinates: [number, number];
      };
    };
  }) {
    const productDetail = new this.productDetailModel(data);
    return productDetail.save();
  }

  /**
   * 상품 상세 정보 조회 (productId로)
   */
  async getProductDetail(productId: number) {
    return this.productDetailModel.findOne({ productId }).exec();
  }

  /**
   * 모든 상품 상세 정보 조회
   */
  async getAllProductDetails() {
    return this.productDetailModel.find().exec();
  }

  /**
   * 상품 상세 정보 업데이트
   */
  async updateProductDetail(
    productId: number,
    updateData: Partial<{
      description: string;
      images: { url: string; alt: string; order: number }[];
      specifications: any;
    }>,
  ) {
    return this.productDetailModel
      .findOneAndUpdate({ productId }, updateData, { new: true })
      .exec();
  }

  /**
   * 상품 상세 정보 삭제
   */
  async deleteProductDetail(productId: number) {
    return this.productDetailModel.findOneAndDelete({ productId }).exec();
  }

  // ===== Message CRUD =====

  /**
   * 메시지 생성
   */
  async createMessage(data: {
    conversationId: string;
    senderId: number;
    receiverId: number;
    message: string;
    messageType?: 'text' | 'image' | 'system';
  }) {
    const message = new this.messageModel(data);
    return message.save();
  }

  /**
   * 대화방의 모든 메시지 조회
   */
  async getMessagesByConversation(conversationId: string) {
    return this.messageModel
      .find({ conversationId })
      .sort({ createdAt: 1 })
      .exec();
  }

  /**
   * 읽지 않은 메시지 조회
   */
  async getUnreadMessages(receiverId: number) {
    return this.messageModel
      .find({ receiverId, readAt: null })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * 메시지 읽음 처리
   */
  async markMessageAsRead(messageId: string) {
    return this.messageModel
      .findByIdAndUpdate(messageId, { readAt: new Date() }, { new: true })
      .exec();
  }

  /**
   * 메시지 삭제
   */
  async deleteMessage(messageId: string) {
    return this.messageModel.findByIdAndDelete(messageId).exec();
  }

  /**
   * 대화방의 모든 메시지 삭제
   */
  async deleteConversation(conversationId: string): Promise<DeleteResult> {
    return this.messageModel.deleteMany({ conversationId }).exec();
  }
}
