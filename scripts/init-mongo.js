// MongoDB 초기화 스크립트
// 중고거래사이트 상품 및 컨텐츠 데이터베이스 설정

// 데이터베이스 전환
db = db.getSiblingDB('secondhand_products');

// 사용자 생성
db.createUser({
  user: 'nestjs',
  pwd: 'password',
  roles: [
    { role: 'readWrite', db: 'secondhand_products' },
    { role: 'dbAdmin', db: 'secondhand_products' }
  ]
});

// 컬렉션 생성 및 인덱스 설정

// 상품 컬렉션
db.createCollection('products');
db.products.createIndex({ "title": "text", "description": "text" });
db.products.createIndex({ "category_id": 1 });
db.products.createIndex({ "seller_id": 1 });
db.products.createIndex({ "price": 1 });
db.products.createIndex({ "location": "2dsphere" });
db.products.createIndex({ "status": 1 });
db.products.createIndex({ "created_at": -1 });
db.products.createIndex({ "updated_at": -1 });

// 리뷰 컬렉션
db.createCollection('reviews');
db.reviews.createIndex({ "product_id": 1 });
db.reviews.createIndex({ "user_id": 1 });
db.reviews.createIndex({ "rating": 1 });
db.reviews.createIndex({ "created_at": -1 });

// 채팅 메시지 컬렉션
db.createCollection('chat_messages');
db.chat_messages.createIndex({ "room_id": 1, "created_at": -1 });
db.chat_messages.createIndex({ "sender_id": 1 });
db.chat_messages.createIndex({ "receiver_id": 1 });

// 사용자 활동 로그
db.createCollection('user_activities');
db.user_activities.createIndex({ "user_id": 1, "timestamp": -1 });
db.user_activities.createIndex({ "activity_type": 1 });
db.user_activities.createIndex({ "timestamp": -1 });

// 검색 기록
db.createCollection('search_history');
db.search_history.createIndex({ "user_id": 1, "searched_at": -1 });
db.search_history.createIndex({ "query": "text" });

// 상품 조회 이력
db.createCollection('product_views');
db.product_views.createIndex({ "product_id": 1, "viewed_at": -1 });
db.product_views.createIndex({ "user_id": 1, "viewed_at": -1 });

// 알림 컬렉션
db.createCollection('notifications');
db.notifications.createIndex({ "user_id": 1, "created_at": -1 });
db.notifications.createIndex({ "type": 1 });
db.notifications.createIndex({ "read": 1 });

// 기본 카테고리 데이터 삽입
db.categories.insertMany([
  {
    _id: ObjectId(),
    name: "전자제품",
    slug: "electronics",
    parent_id: null,
    level: 1,
    order: 1,
    active: true,
    created_at: new Date()
  },
  {
    _id: ObjectId(),
    name: "의류",
    slug: "clothing",
    parent_id: null,
    level: 1,
    order: 2,
    active: true,
    created_at: new Date()
  },
  {
    _id: ObjectId(),
    name: "가구/인테리어",
    slug: "furniture",
    parent_id: null,
    level: 1,
    order: 3,
    active: true,
    created_at: new Date()
  }
]);

print('MongoDB 초기화 완료');
print('사용자 nestjs 생성됨');
print('컬렉션 및 인덱스 생성 완료');