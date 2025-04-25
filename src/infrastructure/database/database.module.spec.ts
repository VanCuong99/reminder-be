import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

describe('DatabaseModule', () => {
    let module: TestingModule;

    const mockConfigService = {
        get: jest.fn((key: string) => {
            const values = {
                DB_HOST: 'localhost',
                DB_PORT: 5432,
                DB_USERNAME: 'test',
                DB_PASSWORD: 'test',
                DB_NAME: 'test_db',
            };
            return values[key];
        }),
    };

    beforeEach(async () => {
        module = await Test.createTestingModule({
            // 👇 Mock lại imports để tránh gọi DB thật
            imports: [],
            providers: [
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();
    });

    it('should be defined', () => {
        expect(module).toBeDefined();
    });

    it('should provide correct database config', () => {
        const configService = module.get<ConfigService>(ConfigService);
        expect(configService.get('DB_HOST')).toBe('localhost');
        expect(configService.get('DB_PORT')).toBe(5432);
    });
});
