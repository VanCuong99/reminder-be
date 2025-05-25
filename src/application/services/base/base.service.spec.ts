import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { PaginationDto, SortDirection } from '../../../presentation/dto/common/pagination.dto';
import { Logger } from '@nestjs/common';

// Create a concrete implementation of BaseService for testing
class TestEntity {
    id: string;
    createdAt: Date;
}

class TestService extends BaseService<TestEntity> {
    constructor(repository: Repository<TestEntity>) {
        super(repository);
    }

    // Expose protected method for testing
    async testPaginate(pagination?: PaginationDto, options = {}) {
        return this.paginate(pagination, options);
    }
}

describe('BaseService', () => {
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
    let service: TestService;
    let repository: Repository<TestEntity>;

    beforeEach(async () => {
        const mockRepository = {
            findAndCount: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                {
                    provide: 'TestEntityRepository',
                    useValue: mockRepository,
                },
                {
                    provide: TestService,
                    useFactory: repo => new TestService(repo),
                    inject: ['TestEntityRepository'],
                },
            ],
        }).compile();

        service = module.get<TestService>(TestService);
        repository = module.get('TestEntityRepository');
    });

    describe('paginate', () => {
        it('should return paginated results with default values', async () => {
            const items = [{ id: '1', createdAt: new Date() }];
            const total = 1;

            jest.spyOn(repository, 'findAndCount').mockResolvedValue([items, total]);

            const result = await service.testPaginate();

            expect(repository.findAndCount).toHaveBeenCalledWith({
                skip: 0,
                take: 10,
                order: { createdAt: 'DESC' },
                relations: undefined,
                where: undefined,
            });

            expect(result).toEqual({
                items,
                total,
                page: 1,
                totalPages: 1,
                hasNext: false,
                hasPrevious: false,
            });
        });

        it('should handle custom pagination parameters', async () => {
            const items = [
                { id: '1', createdAt: new Date() },
                { id: '2', createdAt: new Date() },
            ];
            const total = 22;

            jest.spyOn(repository, 'findAndCount').mockResolvedValue([items, total]);

            const pagination: PaginationDto = {
                page: 2,
                limit: 10,
                sortBy: 'id',
                sortDirection: SortDirection.ASC,
            };

            const result = await service.testPaginate(pagination);

            expect(repository.findAndCount).toHaveBeenCalledWith({
                skip: 10,
                take: 10,
                order: { id: 'ASC' },
                relations: undefined,
                where: undefined,
            });

            expect(result).toEqual({
                items,
                total,
                page: 2,
                totalPages: 3,
                hasNext: true,
                hasPrevious: true,
            });
        });

        it('should handle custom relations and where conditions', async () => {
            const items = [{ id: '1', createdAt: new Date() }];
            const total = 1;

            jest.spyOn(repository, 'findAndCount').mockResolvedValue([items, total]);

            const options = {
                relations: ['user'],
                where: { isActive: true },
            };

            const result = await service.testPaginate(undefined, options);

            expect(repository.findAndCount).toHaveBeenCalledWith({
                skip: 0,
                take: 10,
                order: { createdAt: 'DESC' },
                relations: ['user'],
                where: { isActive: true },
            });

            expect(result).toEqual({
                items,
                total,
                page: 1,
                totalPages: 1,
                hasNext: false,
                hasPrevious: false,
            });
        });

        it('should handle empty results', async () => {
            const items: TestEntity[] = [];
            const total = 0;

            jest.spyOn(repository, 'findAndCount').mockResolvedValue([items, total]);

            const result = await service.testPaginate();

            expect(result).toEqual({
                items: [],
                total: 0,
                page: 1,
                totalPages: 0,
                hasNext: false,
                hasPrevious: false,
            });
        });
    });
});
