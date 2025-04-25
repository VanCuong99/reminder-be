// create-database.spec.ts
import { createDatabase } from './create-database';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

jest.mock('typeorm', () => {
    const actual = jest.requireActual('typeorm');
    return {
        ...actual,
        DataSource: jest.fn(),
    };
});

describe('createDatabase', () => {
    const mockConfigService = {
        get: jest.fn(),
    } as unknown as ConfigService;
    let mockQueryRunner: any;
    let mockDefaultDataSource: any;
    let mockOtherDataSource: any;

    beforeEach(() => {
        (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
            const mockEnv = {
                DEFAULT_DB: 'postgres',
                DB_HOST: 'localhost',
                DB_PORT: 5432,
                DB_USERNAME: 'user',
                DB_PASSWORD: 'pass',
                DB_NAME: 'test_db',
            };
            return mockEnv[key];
        });

        mockQueryRunner = {
            query: jest.fn(),
            release: jest.fn(),
        };

        mockDefaultDataSource = {
            initialize: jest.fn().mockResolvedValue(undefined),
            destroy: jest.fn().mockResolvedValue(undefined),
            createQueryRunner: jest.fn(() => mockQueryRunner),
        };

        mockOtherDataSource = {
            initialize: jest.fn().mockResolvedValue(undefined),
            destroy: jest.fn().mockResolvedValue(undefined),
        };

        (DataSource as jest.Mock).mockImplementation(({ database }) => {
            if (database === 'postgres') return mockDefaultDataSource;
            return mockOtherDataSource;
        });

        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(process, 'exit').mockImplementation(() => {
            throw new Error('ProcessExitCalled');
        });
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    it('should create a new database if it does not exist', async () => {
        mockQueryRunner.query.mockImplementation(sql => {
            if (sql.includes('SELECT')) return [];
        });

        await expect(createDatabase(mockConfigService)).resolves.toBeUndefined();

        expect(mockQueryRunner.query).toHaveBeenCalledWith(
            expect.stringContaining('CREATE DATABASE'),
        );
        expect(mockOtherDataSource.initialize).toHaveBeenCalled();
        expect(mockOtherDataSource.destroy).toHaveBeenCalled();
    });

    it('should skip creation if database exists and is accessible', async () => {
        mockQueryRunner.query.mockImplementation(sql => {
            if (sql.includes('SELECT')) return [{ datname: 'test_db' }];
        });

        await expect(createDatabase(mockConfigService)).resolves.toBeUndefined();

        expect(mockQueryRunner.query).not.toHaveBeenCalledWith(
            expect.stringContaining('CREATE DATABASE'),
        );
        expect(mockOtherDataSource.initialize).toHaveBeenCalled();
        expect(mockOtherDataSource.destroy).toHaveBeenCalled();
    });

    it('should exit if DEFAULT_DB is not set', async () => {
        mockConfigService.get = jest.fn(key => {
            if (key === 'DEFAULT_DB') return null;
            return 'value';
        });

        await expect(createDatabase(mockConfigService)).rejects.toThrow('ProcessExitCalled');
        expect(console.error).toHaveBeenCalledWith('DEFAULT_DB environment variable is not set');
    });

    it('should exit if existing database is not accessible', async () => {
        mockQueryRunner.query.mockResolvedValue([{ datname: 'test_db' }]);
        mockOtherDataSource.initialize.mockRejectedValue(new Error('Connection failed'));

        await expect(createDatabase(mockConfigService)).rejects.toThrow('ProcessExitCalled');
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('Database test_db exists but is not accessible'),
            expect.any(Error),
        );
    });
});
