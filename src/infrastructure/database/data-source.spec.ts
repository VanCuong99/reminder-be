import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';

// Mock ConfigService
const mockConfigService = {
    get: jest.fn((key: string) => {
        const values = {
            DB_HOST: 'localhost',
            DB_PORT: '5432',
            DB_USERNAME: 'test',
            DB_PASSWORD: 'test',
            DB_NAME: 'test_db',
        };
        return values[key];
    }),
};

describe('DataSource', () => {
    let dataSource: DataSource;

    beforeEach(() => {
        // Mock ConfigService vào DataSource
        jest.spyOn(ConfigService.prototype, 'get').mockImplementation(mockConfigService.get);
        dataSource = new DataSource({
            type: 'postgres',
            host: mockConfigService.get('DB_HOST'),
            port: parseInt(mockConfigService.get('DB_PORT') ?? '5432', 10),
            username: mockConfigService.get('DB_USERNAME'),
            password: mockConfigService.get('DB_PASSWORD'),
            database: mockConfigService.get('DB_NAME'),
            entities: ['dist/**/*.entity{.ts,.js}'],
            migrations: ['dist/infrastructure/database/migrations/*{.ts,.js}'],
            synchronize: false,
            logging: true,
        });
    });

    it('should have correct postgres config', () => {
        const options = dataSource.options;

        // Kiểm tra các thuộc tính chỉ có khi sử dụng PostgreSQL
        if (options.type === 'postgres') {
            expect(options.host).toBe('localhost');
            expect(options.port).toBe(5432);
            expect(options.username).toBe('test');
            expect(options.password).toBe('test');
            expect(options.database).toBe('test_db');
        }
    });
});
