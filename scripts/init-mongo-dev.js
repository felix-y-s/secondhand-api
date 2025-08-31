// MongoDB 개발환경 초기화 스크립트

db = db.getSiblingDB('secondhand_products_dev');

// 개발용 사용자 생성
db.createUser({
  user: 'nestjs_dev',
  pwd: 'password',
  roles: [
    { role: 'readWrite', db: 'secondhand_products_dev' },
    { role: 'dbAdmin', db: 'secondhand_products_dev' }
  ]
});

// 개발용 컬렉션 생성
db.createCollection('dev_products');
db.createCollection('dev_test_data');

// 기본 인덱스
db.dev_products.createIndex({ "title": "text" });
db.dev_products.createIndex({ "created_at": -1 });

// 개발용 샘플 데이터
db.dev_products.insertMany([
  {
    title: "개발용 테스트 상품 1",
    description: "개발 환경 테스트용 샘플 데이터",
    price: 10000,
    category: "test",
    seller_id: "dev-user-1",
    status: "active",
    created_at: new Date()
  },
  {
    title: "개발용 테스트 상품 2",
    description: "API 테스트용 샘플 데이터",
    price: 20000,
    category: "test",
    seller_id: "dev-user-2",
    status: "active",
    created_at: new Date()
  }
]);

print('MongoDB 개발환경 초기화 완료');
print('개발용 사용자 및 테스트 데이터 생성됨');