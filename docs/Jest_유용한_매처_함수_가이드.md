# Jest 유용한 매처(Matcher) 함수 가이드

Jest 테스트 작성 시 자주 사용되는 유용한 매처 함수들을 정리한 문서입니다.

## 목차
1. [기본 비교 매처](#1-기본-비교-매처)
2. [객체 및 배열 매처](#2-객체-및-배열-매처)
3. [타입 검증 매처](#3-타입-검증-매처)
4. [문자열 매처](#4-문자열-매처)
5. [숫자 매처](#5-숫자-매cher)
6. [예외 및 비동기 매처](#6-예외-및-비동기-매처)
7. [스냅샷 테스팅](#7-스냅샷-테스팅)
8. [Mock 관련 매처](#8-mock-관련-매처)
9. [실전 활용 예시](#9-실전-활용-예시)

---

## 1. 기본 비교 매처

### `toBe()` - 원시값 동일성 검증 (===)
참조 비교를 수행합니다. 원시값(string, number, boolean)에 사용합니다.

```typescript
test('원시값 비교', () => {
  expect(2 + 2).toBe(4);
  expect('hello').toBe('hello');
  expect(true).toBe(true);
  expect(null).toBe(null);
});
```

### `toEqual()` - 값 동일성 검증 (deep equality)
객체의 값을 재귀적으로 비교합니다. 객체와 배열에 사용합니다.

```typescript
test('객체 값 비교', () => {
  const user = { id: 1, name: 'John' };
  expect(user).toEqual({ id: 1, name: 'John' });

  const arr = [1, 2, 3];
  expect(arr).toEqual([1, 2, 3]);
});
```

### `toStrictEqual()` - 엄격한 값 검증
`toEqual()`보다 엄격합니다. `undefined` 속성과 배열의 희소성을 검사합니다.

```typescript
test('엄격한 비교', () => {
  // toEqual은 통과하지만 toStrictEqual은 실패
  expect({ a: undefined, b: 2 }).toEqual({ b: 2 }); // ✅
  expect({ a: undefined, b: 2 }).toStrictEqual({ b: 2 }); // ❌

  // 배열 희소성 검사
  const arr = [1, , 3]; // 중간에 빈 요소
  expect(arr).toEqual([1, undefined, 3]); // ✅
  expect(arr).toStrictEqual([1, undefined, 3]); // ❌
});
```

---

## 2. 객체 및 배열 매처

### `toMatchObject()` - 부분 객체 매칭
객체의 일부 속성만 비교합니다. 명시하지 않은 속성은 무시됩니다.

```typescript
test('부분 객체 매칭', () => {
  const user = {
    id: 1,
    name: 'John',
    email: 'john@example.com',
    createdAt: '2024-01-15T10:30:00Z'
  };

  // id와 name만 확인 (email, createdAt은 무시)
  expect(user).toMatchObject({
    id: 1,
    name: 'John'
  });
});
```

### `expect.objectContaining()` - 부분 객체 매칭 헬퍼
다른 매처와 조합하여 사용합니다. 특히 `toContainEqual()`과 함께 자주 사용됩니다.

```typescript
test('배열 내 부분 객체 매칭', () => {
  const notifications = [
    { id: 1, title: '알림1', isRead: false, createdAt: '2024-01-15' },
    { id: 2, title: '알림2', isRead: true, createdAt: '2024-01-16' }
  ];

  // id가 1인 알림이 배열에 존재하는지만 확인
  expect(notifications).toContainEqual(
    expect.objectContaining({ id: 1 })
  );

  // 여러 속성 확인
  expect(notifications).toContainEqual(
    expect.objectContaining({
      id: 2,
      isRead: true
    })
  );
});
```

### `toContain()` - 배열 원시값 포함 여부
배열에 특정 원시값이 포함되어 있는지 확인합니다.

```typescript
test('배열 원시값 포함', () => {
  const arr = [1, 2, 3, 4, 5];
  expect(arr).toContain(3);

  const fruits = ['apple', 'banana', 'orange'];
  expect(fruits).toContain('banana');
});
```

### `toContainEqual()` - 배열 객체값 포함 여부
배열에 특정 객체가 값으로 포함되어 있는지 확인합니다 (deep equality).

```typescript
test('배열 객체값 포함', () => {
  const users = [
    { id: 1, name: 'John' },
    { id: 2, name: 'Jane' }
  ];

  expect(users).toContainEqual({ id: 1, name: 'John' });
});
```

### `toHaveProperty()` - 속성 존재 여부 및 값 확인
객체에 특정 속성이 존재하는지, 그리고 특정 값을 갖는지 확인합니다.

```typescript
test('속성 존재 및 값 확인', () => {
  const user = {
    id: 1,
    profile: {
      name: 'John',
      age: 30
    }
  };

  // 속성 존재 확인
  expect(user).toHaveProperty('id');

  // 속성 값 확인
  expect(user).toHaveProperty('id', 1);

  // 중첩 속성 확인
  expect(user).toHaveProperty('profile.name', 'John');
  expect(user).toHaveProperty(['profile', 'age'], 30);
});
```

### `toHaveLength()` - 배열/문자열 길이 확인
```typescript
test('길이 확인', () => {
  expect([1, 2, 3]).toHaveLength(3);
  expect('hello').toHaveLength(5);
  expect({ length: 10 }).toHaveLength(10);
});
```

---

## 3. 타입 검증 매처

### `expect.any()` - 타입 검증
생성자 함수를 받아 해당 타입인지 확인합니다.

```typescript
test('타입 검증', () => {
  expect('hello').toEqual(expect.any(String));
  expect(123).toEqual(expect.any(Number));
  expect(true).toEqual(expect.any(Boolean));
  expect([1, 2, 3]).toEqual(expect.any(Array));
  expect({ id: 1 }).toEqual(expect.any(Object));
  expect(new Date()).toEqual(expect.any(Date));

  // 스냅샷과 함께 사용
  const response = {
    id: 123,
    createdAt: new Date().toISOString()
  };

  expect(response).toMatchSnapshot({
    id: expect.any(Number),
    createdAt: expect.any(String)
  });
});
```

### `expect.anything()` - null/undefined가 아닌 모든 값
```typescript
test('null/undefined가 아닌 값', () => {
  expect('hello').toEqual(expect.anything());
  expect(0).toEqual(expect.anything());
  expect([]).toEqual(expect.anything());

  // null, undefined는 실패
  expect(null).not.toEqual(expect.anything());
  expect(undefined).not.toEqual(expect.anything());
});
```

### `toBeDefined()` / `toBeUndefined()` - undefined 검증
```typescript
test('undefined 검증', () => {
  let value;
  expect(value).toBeUndefined();

  value = 'hello';
  expect(value).toBeDefined();
});
```

### `toBeNull()` - null 검증
```typescript
test('null 검증', () => {
  const value = null;
  expect(value).toBeNull();
  expect(value).not.toBeUndefined();
});
```

### `toBeTruthy()` / `toBeFalsy()` - 진리값 검증
```typescript
test('진리값 검증', () => {
  // Truthy
  expect(true).toBeTruthy();
  expect(1).toBeTruthy();
  expect('hello').toBeTruthy();
  expect([]).toBeTruthy();
  expect({}).toBeTruthy();

  // Falsy
  expect(false).toBeFalsy();
  expect(0).toBeFalsy();
  expect('').toBeFalsy();
  expect(null).toBeFalsy();
  expect(undefined).toBeFalsy();
  expect(NaN).toBeFalsy();
});
```

---

## 4. 문자열 매처

### `toMatch()` - 정규표현식 매칭
```typescript
test('문자열 패턴 매칭', () => {
  expect('hello world').toMatch(/world/);
  expect('test@example.com').toMatch(/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/);

  // 문자열로도 가능
  expect('hello world').toMatch('world');
});
```

### `toContain()` - 부분 문자열 포함
```typescript
test('부분 문자열 포함', () => {
  expect('hello world').toContain('world');
  expect('NestJS Framework').toContain('NestJS');
});
```

### `toHaveLength()` - 문자열 길이
```typescript
test('문자열 길이', () => {
  expect('hello').toHaveLength(5);
  expect('').toHaveLength(0);
});
```

---

## 5. 숫자 매처

### `toBeGreaterThan()` / `toBeGreaterThanOrEqual()` - 크기 비교 (>= )
```typescript
test('크기 비교', () => {
  expect(10).toBeGreaterThan(5);
  expect(10).toBeGreaterThanOrEqual(10);
  expect(10).toBeGreaterThanOrEqual(5);
});
```

### `toBeLessThan()` / `toBeLessThanOrEqual()` - 크기 비교 (<=)
```typescript
test('크기 비교', () => {
  expect(5).toBeLessThan(10);
  expect(5).toBeLessThanOrEqual(5);
  expect(5).toBeLessThanOrEqual(10);
});
```

### `toBeCloseTo()` - 부동소수점 비교
부동소수점 오차를 고려한 비교입니다.

```typescript
test('부동소수점 비교', () => {
  // 일반 비교는 실패할 수 있음
  expect(0.1 + 0.2).not.toBe(0.3); // 부동소수점 오차

  // toBeCloseTo 사용
  expect(0.1 + 0.2).toBeCloseTo(0.3);
  expect(0.1 + 0.2).toBeCloseTo(0.3, 5); // 소수점 5자리까지 정확도
});
```

---

## 6. 예외 및 비동기 매처

### `toThrow()` - 예외 발생 검증
```typescript
test('예외 발생', () => {
  function throwError() {
    throw new Error('Something went wrong');
  }

  // 함수를 래핑해야 함
  expect(() => throwError()).toThrow();
  expect(() => throwError()).toThrow(Error);
  expect(() => throwError()).toThrow('Something went wrong');
  expect(() => throwError()).toThrow(/wrong/);
});
```

### `resolves` / `rejects` - Promise 검증
```typescript
test('Promise 검증', async () => {
  // 성공하는 Promise
  await expect(Promise.resolve('success')).resolves.toBe('success');

  // 실패하는 Promise
  await expect(Promise.reject(new Error('failed')))
    .rejects.toThrow('failed');

  // 비동기 함수
  async function fetchUser() {
    return { id: 1, name: 'John' };
  }

  await expect(fetchUser()).resolves.toMatchObject({
    id: 1,
    name: 'John'
  });
});
```

---

## 7. 스냅샷 테스팅

### `toMatchSnapshot()` - 스냅샷 비교
UI 컴포넌트나 복잡한 데이터 구조를 스냅샷으로 저장하고 비교합니다.

```typescript
test('기본 스냅샷', () => {
  const user = {
    id: 1,
    name: 'John',
    email: 'john@example.com'
  };

  // 첫 실행: 스냅샷 생성
  // 이후 실행: 스냅샷과 비교
  expect(user).toMatchSnapshot();
});
```

### 동적 값이 포함된 스냅샷
동적으로 생성되는 값(날짜, UUID 등)을 처리하는 방법입니다.

```typescript
test('동적 값 스냅샷', () => {
  const notification = {
    id: 'uuid-123-456', // 동적으로 생성됨
    title: '📣 테스트 알림',
    message: '알림 테스트입니다.',
    createdAt: new Date().toISOString(), // 동적 날짜
    isRead: false
  };

  // 동적 값을 타입으로 대체
  expect(notification).toMatchSnapshot({
    id: expect.any(String),
    createdAt: expect.any(String)
  });

  // 스냅샷 파일에는 다음과 같이 저장됨:
  // {
  //   id: Any<String>,
  //   title: '📣 테스트 알림',
  //   message: '알림 테스트입니다.',
  //   createdAt: Any<String>,
  //   isRead: false
  // }
});
```

### `toMatchInlineSnapshot()` - 인라인 스냅샷
별도 파일 없이 코드 내에서 스냅샷을 관리합니다.

```typescript
test('인라인 스냅샷', () => {
  const result = { status: 'success', code: 200 };

  // 첫 실행 시 Jest가 자동으로 스냅샷 코드를 추가
  expect(result).toMatchInlineSnapshot(`
    {
      "code": 200,
      "status": "success",
    }
  `);
});
```

### 스냅샷 업데이트
```bash
# 스냅샷 업데이트 (의도적으로 변경된 경우)
npm test -- -u
# 또는
npm test -- --updateSnapshot
```

---

## 8. Mock 관련 매처

### `toHaveBeenCalled()` - 호출 여부 확인
```typescript
test('함수 호출 확인', () => {
  const mockFn = jest.fn();

  mockFn();

  expect(mockFn).toHaveBeenCalled();
});
```

### `toHaveBeenCalledTimes()` - 호출 횟수 확인
```typescript
test('호출 횟수 확인', () => {
  const mockFn = jest.fn();

  mockFn();
  mockFn();
  mockFn();

  expect(mockFn).toHaveBeenCalledTimes(3);
});
```

### `toHaveBeenCalledWith()` - 호출 인자 확인
```typescript
test('호출 인자 확인', () => {
  const mockFn = jest.fn();

  mockFn('hello', 123);

  expect(mockFn).toHaveBeenCalledWith('hello', 123);
  expect(mockFn).toHaveBeenCalledWith(
    expect.any(String),
    expect.any(Number)
  );
});
```

### `toHaveBeenLastCalledWith()` - 마지막 호출 인자 확인
```typescript
test('마지막 호출 인자', () => {
  const mockFn = jest.fn();

  mockFn('first');
  mockFn('second');
  mockFn('last');

  expect(mockFn).toHaveBeenLastCalledWith('last');
});
```

### `toHaveBeenNthCalledWith()` - N번째 호출 인자 확인
```typescript
test('N번째 호출 인자', () => {
  const mockFn = jest.fn();

  mockFn('first');
  mockFn('second');
  mockFn('third');

  expect(mockFn).toHaveBeenNthCalledWith(1, 'first');
  expect(mockFn).toHaveBeenNthCalledWith(2, 'second');
  expect(mockFn).toHaveBeenNthCalledWith(3, 'third');
});
```

### `toHaveReturned()` - 반환값 확인
```typescript
test('함수 반환 확인', () => {
  const mockFn = jest.fn(() => 'result');

  mockFn();

  expect(mockFn).toHaveReturned();
  expect(mockFn).toHaveReturnedWith('result');
});
```

---

## 9. 실전 활용 예시

### E2E 테스트: API 응답 검증
```typescript
describe('알림 API E2E 테스트', () => {
  it('알림 생성 후 목록 조회', async () => {
    // 1. 알림 생성
    const created = await request(app.getHttpServer())
      .post('/api/v1/notifications')
      .send({
        userId: testUserId,
        type: 'NEW_MESSAGE',
        title: '📣 테스트 알림',
        message: '알림 테스트입니다.'
      })
      .expect(201);

    // 생성된 알림 ID 저장
    const notificationId = created.body.data.id;

    // 생성 응답 검증 (동적 값 처리)
    expect(created.body).toMatchSnapshot({
      data: {
        id: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      }
    });

    // 2. 알림 목록 조회
    const list = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .expect(200);

    // 생성한 알림이 목록에 있는지 확인 (부분 매칭)
    expect(list.body.data.items).toContainEqual(
      expect.objectContaining({
        id: notificationId,
        title: '📣 테스트 알림'
      })
    );

    // 페이지네이션 정보 검증
    expect(list.body.data).toMatchObject({
      total: expect.any(Number),
      page: 1,
      totalPages: expect.any(Number),
      unreadCount: expect.any(Number)
    });

    // 배열 길이 검증
    expect(list.body.data.items.length).toBeGreaterThan(0);
  });
});
```

### 단위 테스트: Service 로직 검증
```typescript
describe('NotificationsService', () => {
  it('알림 읽음 처리', async () => {
    // Mock 설정
    const mockRepository = {
      markAsRead: jest.fn().mockResolvedValue({ count: 1 })
    };

    const service = new NotificationsService(
      mockRepository as any
    );

    // 실행
    const result = await service.markAsRead('notif-123', 'user-456');

    // Mock 호출 검증
    expect(mockRepository.markAsRead).toHaveBeenCalledTimes(1);
    expect(mockRepository.markAsRead).toHaveBeenCalledWith(
      'notif-123',
      'user-456'
    );

    // 반환값 검증
    expect(result).toEqual({ count: 1 });
    expect(result.count).toBeGreaterThanOrEqual(0);
  });

  it('존재하지 않는 알림 읽음 처리', async () => {
    const mockRepository = {
      markAsRead: jest.fn().mockResolvedValue({ count: 0 })
    };

    const service = new NotificationsService(
      mockRepository as any
    );

    const result = await service.markAsRead('invalid-id', 'user-456');

    // 업데이트된 항목이 없음
    expect(result.count).toBe(0);
  });
});
```

### 통합 테스트: Repository 검증
```typescript
describe('NotificationsRepository 통합 테스트', () => {
  let repository: NotificationsRepository;
  let prisma: PrismaService;

  beforeAll(async () => {
    // 테스트 DB 연결
    prisma = new PrismaService();
    repository = new NotificationsRepository(prisma);
  });

  it('알림 목록 페이지네이션', async () => {
    const userId = 'test-user-123';

    // 테스트 데이터 생성
    await Promise.all([
      repository.create({
        userId,
        type: 'NEW_MESSAGE',
        title: '알림1',
        message: '메시지1'
      }),
      repository.create({
        userId,
        type: 'NEW_MESSAGE',
        title: '알림2',
        message: '메시지2'
      }),
      repository.create({
        userId,
        type: 'NEW_MESSAGE',
        title: '알림3',
        message: '메시지3'
      })
    ]);

    // 1페이지 조회 (limit: 2)
    const page1 = await repository.findMany(userId, 1, 2);

    expect(page1.items).toHaveLength(2);
    expect(page1.total).toBeGreaterThanOrEqual(3);
    expect(page1.page).toBe(1);
    expect(page1.totalPages).toBeGreaterThanOrEqual(2);

    // 각 알림 구조 검증
    page1.items.forEach(notification => {
      expect(notification).toMatchObject({
        id: expect.any(String),
        userId,
        type: expect.any(String),
        title: expect.any(String),
        message: expect.any(String),
        isRead: expect.any(Boolean),
        createdAt: expect.any(Date)
      });
    });
  });
});
```

---

## 매처 선택 가이드

### 원시값 비교
```typescript
✅ expect(value).toBe(expected)          // 권장
❌ expect(value).toEqual(expected)        // 동작하지만 불필요
```

### 객체 비교
```typescript
✅ expect(obj).toEqual(expected)         // 권장 (전체 비교)
✅ expect(obj).toMatchObject(partial)    // 권장 (부분 비교)
❌ expect(obj).toBe(expected)            // 참조 비교 (거의 실패)
```

### 배열 요소 포함
```typescript
✅ expect(arr).toContain(1)              // 원시값
✅ expect(arr).toContainEqual({id: 1})   // 객체값
❌ expect(arr.includes(1)).toBe(true)    // 불필요하게 복잡
```

### 동적 값 검증
```typescript
✅ expect(val).toEqual(expect.any(String))           // 타입만 확인
✅ expect(obj).toMatchSnapshot({ id: expect.any(String) }) // 스냅샷 + 타입
❌ expect(typeof val).toBe('string')                 // 불필요하게 복잡
```

### Mock 호출 검증
```typescript
✅ expect(mock).toHaveBeenCalledWith('arg')          // 정확한 인자
✅ expect(mock).toHaveBeenCalledWith(expect.any(String)) // 타입만 확인
❌ expect(mock.mock.calls[0][0]).toBe('arg')        // 직접 접근 (비권장)
```

---

## 참고 자료

- [Jest 공식 문서 - Expect](https://jestjs.io/docs/expect)
- [Jest 공식 문서 - Using Matchers](https://jestjs.io/docs/using-matchers)
- [Jest 공식 문서 - Snapshot Testing](https://jestjs.io/docs/snapshot-testing)
- [Jest 공식 문서 - Mock Functions](https://jestjs.io/docs/mock-functions)

---

## 요약

| 카테고리 | 주요 매처 | 사용 시기 |
|---------|----------|----------|
| **기본 비교** | `toBe()`, `toEqual()` | 원시값/객체 비교 |
| **객체 검증** | `toMatchObject()`, `expect.objectContaining()` | 부분 객체 매칭 |
| **배열 검증** | `toContain()`, `toContainEqual()` | 배열 요소 포함 확인 |
| **타입 검증** | `expect.any()`, `toBeDefined()` | 타입 확인 |
| **문자열** | `toMatch()`, `toContain()` | 문자열 패턴/포함 |
| **숫자** | `toBeGreaterThan()`, `toBeCloseTo()` | 크기 비교, 부동소수점 |
| **비동기** | `resolves`, `rejects`, `toThrow()` | Promise, 예외 처리 |
| **스냅샷** | `toMatchSnapshot()` | 복잡한 데이터 구조 |
| **Mock** | `toHaveBeenCalled()`, `toHaveBeenCalledWith()` | Mock 함수 검증 |

이 문서의 매처들을 적재적소에 활용하면 더 명확하고 유지보수하기 쉬운 테스트 코드를 작성할 수 있습니다.
