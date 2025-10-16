import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * 상품 상세 정보 스키마
 * PostgreSQL에 저장되는 기본 정보 외의 확장 정보를 MongoDB에 저장
 * - 상세 설명
 * - 이미지 배열
 * - 위치 정보
 * - 메타데이터 (조회수, 좋아요, 태그)
 */
@Schema({ collection: 'product_details', timestamps: true })
export class ProductDetail extends Document {
  // PostgreSQL의 Product ID와 연결
  @Prop({ required: true, unique: true })
  productId: number;

  // 상세 설명 (마크다운 지원)
  @Prop({ required: true })
  description: string;

  // 이미지 배열 (URL, alt 텍스트, 순서)
  @Prop({ type: [{ url: String, alt: String, order: Number }] })
  images: { url: string; alt: string; order: number }[];

  // 상품 상세 스펙
  @Prop({
    type: {
      brand: String,
      condition: String,
      location: {
        city: String,
        district: String,
        coordinates: [Number],
      },
    },
  })
  specifications: {
    brand?: string;
    condition?: string;
    location?: {
      city: string;
      district: string;
      coordinates: [number, number]; // [경도, 위도]
    };
  };

  // 메타데이터
  @Prop({ type: { views: Number, likes: Number, tags: [String] }, default: {} })
  metadata: {
    views: number;
    likes: number;
    tags: string[];
  };
}

export const ProductDetailSchema = SchemaFactory.createForClass(ProductDetail);

// 인덱스 설정
ProductDetailSchema.index({ productId: 1 });
ProductDetailSchema.index({ 'specifications.location.coordinates': '2dsphere' });
ProductDetailSchema.index({ 'metadata.tags': 1 });
