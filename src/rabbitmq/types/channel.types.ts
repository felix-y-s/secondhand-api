export interface ConsumerChannelOptions {
  queueName: string;
  exchangeName?: string;
  /** 🔥 Exchange 타입 (기본: topic) */
  exchangeType?: 'direct' | 'topic' | 'fanout' | 'headers';
  /** 🔥 Exchange 옵션 */
  exchangeOptions?: {
    durable?: boolean;
    autoDelete?: boolean;
    internal?: boolean;
  };
  /** Routing Key 패턴 */
  routingKey?: string;
  /** Queue 옵션 */
  queueOptions?: {
    durable?: boolean;
    exclusive?: boolean;
    autoDelete?: boolean;
    deadLetterExchange?: string;
    deadLetterRoutingKey?: string;
    messageTtl?: number;
    maxLength?: number;
    maxPriority?: number;
  };
  /** Prefetch Count */
  prefetchCount?: number;
}
