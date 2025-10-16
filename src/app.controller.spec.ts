import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongodbService } from './database/mongodb/mongodb.service';
import { RedisService } from './database/redis/redis.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

describe('AppController', () => {
  let appController: AppController;

  const mockMongodbService = {};
  const mockRedisService = {};
  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: MongodbService,
          useValue: mockMongodbService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: WINSTON_MODULE_NEST_PROVIDER,
          useValue: mockLogger,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
