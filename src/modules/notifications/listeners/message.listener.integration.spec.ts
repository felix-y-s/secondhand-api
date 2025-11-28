import { Test, TestingModule } from '@nestjs/testing';
import { MessageListener } from './message.listener';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';

describe('MessageListener', () => {
  let messageListener: MessageListener;
  let eventEmitter: EventEmitter2;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [MessageListener],
    }).compile();

    // ⭐️ 모듈 초기화 - 이 메서드가 @OnEvent 데코레이터를 등록하고 이벤트 리스너를 활성화합니다
    await module.init();

    messageListener = module.get<MessageListener>(MessageListener);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('message.sent 이벤트 발송', async () => {
    // 리스너의 handleMessageSent 메서드에 스파이 설정
    const spy = jest.spyOn(messageListener, 'handleMessageSent');

    // 이벤트 발송
    eventEmitter.emit('message.sent', { name: 'kum' });

    // 메서드가 호출되었는지 확인
    expect(spy).toHaveBeenCalledWith({ name: 'kum1' });
    expect(spy).toHaveBeenCalledTimes(1);
  })
});