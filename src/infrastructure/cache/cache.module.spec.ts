import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CacheModule } from './cache.module';
import { RedisService } from './redis.service';
import { Logger } from '@nestjs/common';

describe('CacheModule', () => {
    // Silence all logger output for all tests
    let loggerErrorSpy: jest.SpyInstance;
    let loggerDebugSpy: jest.SpyInstance;
    let loggerWarnSpy: jest.SpyInstance;
    let loggerLogSpy: jest.SpyInstance;
    beforeAll(() => {
        loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
        loggerDebugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
        loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
        loggerLogSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    });
    afterAll(() => {
        loggerErrorSpy.mockRestore();
        loggerDebugSpy.mockRestore();
        loggerWarnSpy.mockRestore();
        loggerLogSpy.mockRestore();
    });
    let module: TestingModule;
    const mockConfigService = {
        get: jest.fn().mockImplementation((key: string) => {
            switch (key) {
                case 'REDIS_ENABLED':
                    return 'false';
                default:
                    return undefined;
            }
        }),
    };
    beforeEach(async () => {
        module = await Test.createTestingModule({
            imports: [CacheModule],
        })
            .overrideProvider(ConfigService)
            .useValue(mockConfigService)
            .compile();
    });

    it('should be defined', () => {
        expect(module).toBeDefined();
    });

    it('should provide RedisService', () => {
        const redisService = module.get<RedisService>(RedisService);
        expect(redisService).toBeDefined();
    });

    it('should export RedisService', () => {
        const exports = Reflect.getMetadata('exports', CacheModule);
        expect(exports).toContain(RedisService);
    });

    it('should be marked as global module', () => {
        const isGlobal = Reflect.getMetadata('__module:global__', CacheModule);
        expect(isGlobal).toBe(true);
    });
});
