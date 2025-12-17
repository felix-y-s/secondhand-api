# 권장 네이밍 패턴
MessageFixture 클래스 내부 메서드 분류
```ts
export class MessageFixture {
  
  // ===== 1. 단순 DB 생성 (Fixture) =====
  // 접두사: create + 엔티티명
  
  async createChatRoom() { }      // ✅ DB에 채팅방만 생성
  async createMessage() { }       // ✅ DB에 메시지만 생성
  async createUser() { }          // ✅ DB에 사용자만 생성
  
  
  // ===== 2. 복합 데이터 생성 (Builder) =====
  // 접두사: build + 설명
  
  async buildChatRoomWithMessages() { }  // ✅ 채팅방 + 메시지 조합
  async buildUnreadMessages() { }        // ✅ 읽지 않은 메시지들 생성
  
  
  // ===== 3. 테스트 컨텍스트 생성 (Context Helper) =====
  // 접두사: build + 설명 + Context
  
  async buildAuthContext() { }           // ✅ 인증된 사용자 컨텍스트
  async buildChatContext() { }           // ✅ 채팅 테스트 컨텍스트
  async buildSellerBuyerContext() { }    // ✅ 판매자-구매자 컨텍스트
}
```

**🤫 파일 내용이 너무 길어진다면**
test/
 ├─ fixtures/
 │   └─ user.fixture.ts      // DB 상태만 생성
 ├─ contexts/
 │   └─ auth.context.ts      // API 입력만 생성