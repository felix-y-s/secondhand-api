import * as amqp from 'amqp-connection-manager';
import { ConfirmChannel } from 'amqplib';

/**
 * 간단한 RabbitMQ 연결 테스트
 *
 * RabbitMQ 연결 자체에 문제가 있는지 확인
 */
describe('간단한 RabbitMQ 연결 테스트', () => {
  jest.setTimeout(10000);

  it('RabbitMQ에 연결할 수 있어야 함', async () => {
    // 연결 생성
    const connection = amqp.connect([
      'amqp://admin:SecurePassword123!@localhost:5672',
    ]);

    // 연결 이벤트 리스너
    const connectPromise = new Promise<void>((resolve, reject) => {
      connection.on('connect', () => {
        console.log('✅ RabbitMQ 연결 성공');
        resolve();
      });

      connection.on('disconnect', (err) => {
        console.error('❌ RabbitMQ 연결 끊김:', err);
        reject(err);
      });

      // 5초 타임아웃
      setTimeout(() => {
        reject(new Error('연결 타임아웃'));
      }, 5000);
    });

    await connectPromise;

    // 채널 생성
    const channelWrapper = connection.createChannel({
      json: false,
      setup: async (channel: ConfirmChannel) => {
        console.log('✅ 채널 설정 시작');
        // 간단한 Exchange만 생성
        await channel.assertExchange('test.exchange', 'topic', {
          durable: true,
        });
        console.log('✅ Exchange 생성 완료');
      },
    });

    console.log('⏳ 채널 연결 대기 중...');
    await channelWrapper.waitForConnect();
    console.log('✅ 채널 연결 완료');

    // 정리
    await channelWrapper.close();
    await connection.close();

    expect(true).toBe(true);
  });
});
