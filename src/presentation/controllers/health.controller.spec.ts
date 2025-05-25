import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HealthController } from './health.controller';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { FirebaseService } from '../../infrastructure/firestore/firebase.service';
import { User } from '../../domain/entities/user.entity';

describe('HealthController', () => {
    let controller: HealthController;
    let userRepository: Repository<User>;
    let redisService: RedisService;
    let firebaseService: FirebaseService;

    const mockUserRepository = {
        count: jest.fn(),
    };

    const mockRedisService = {
        set: jest.fn(),
        get: jest.fn(),
    };

    const mockFirebaseService = {
        getFirestore: jest.fn().mockReturnValue({
            listCollections: jest.fn(),
        }),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [HealthController],
            providers: [
                {
                    provide: getRepositoryToken(User),
                    useValue: mockUserRepository,
                },
                {
                    provide: RedisService,
                    useValue: mockRedisService,
                },
                {
                    provide: FirebaseService,
                    useValue: mockFirebaseService,
                },
            ],
        }).compile();

        controller = module.get<HealthController>(HealthController);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('check', () => {
        it('should return healthy status when all services are working', async () => {
            // Mock successful responses
            mockUserRepository.count.mockResolvedValue(1);
            mockRedisService.set.mockResolvedValue('OK');
            mockRedisService.get
                .mockResolvedValueOnce('ok') // For health check
                .mockResolvedValueOnce('false'); // For maintenance mode
            mockFirebaseService.getFirestore().listCollections.mockResolvedValue([]);

            const result = await controller.check();

            expect(result.status).toBe('ok');
            expect(result.services.database.status).toBe('ok');
            expect(result.services.redis.status).toBe('ok');
            expect(result.services.firebase.status).toBe('ok');
            expect(result.maintenance).toBe(false);
            expect(result.version).toBeDefined();
        });

        it('should handle database connection error', async () => {
            mockUserRepository.count.mockRejectedValue(new Error('DB Connection failed'));
            mockRedisService.set.mockResolvedValue('OK');
            mockRedisService.get.mockResolvedValue('ok');
            mockFirebaseService.getFirestore().listCollections.mockResolvedValue([]);

            await expect(controller.check()).rejects.toThrow();
        });

        it('should handle redis connection error', async () => {
            mockUserRepository.count.mockResolvedValue(1);
            mockRedisService.set.mockRejectedValue(new Error('Redis Connection failed'));
            mockFirebaseService.getFirestore().listCollections.mockResolvedValue([]);

            const result = await controller.check();

            expect(result.status).toBe('error');
            expect(result.services.redis.status).toBe('error');
            expect(result.services.redis.message).toContain('Redis Connection failed');
        });

        it('should handle firebase connection error', async () => {
            mockUserRepository.count.mockResolvedValue(1);
            mockRedisService.set.mockResolvedValue('OK');
            mockRedisService.get.mockResolvedValueOnce('ok').mockResolvedValueOnce('false');
            mockFirebaseService
                .getFirestore()
                .listCollections.mockRejectedValue(new Error('Firebase Connection failed'));

            const result = await controller.check();

            expect(result.status).toBe('error');
            expect(result.services.firebase.status).toBe('error');
            expect(result.services.firebase.message).toContain('Firebase Connection failed');
        });

        it('should handle firebase connection error with no error.message', async () => {
            mockUserRepository.count.mockResolvedValue(1);
            mockRedisService.set.mockResolvedValue('OK');
            mockRedisService.get.mockResolvedValueOnce('ok').mockResolvedValueOnce('false');
            // Simulate getFirestore throwing an error without a message property
            mockFirebaseService.getFirestore.mockImplementation(() => {
                throw {};
            });

            const result = await controller.check();

            expect(result.status).toBe('error');
            expect(result.services.firebase.status).toBe('error');
            expect(result.services.firebase.message).toContain('Could not connect to Firebase');
        });

        it('should detect maintenance mode when enabled', async () => {
            mockUserRepository.count.mockResolvedValue(1);
            mockRedisService.set.mockResolvedValue('OK');
            mockRedisService.get.mockResolvedValueOnce('ok').mockResolvedValueOnce('true');

            // Re-assign the listCollections mock to ensure it resolves for this test
            const firestoreMock = { listCollections: jest.fn().mockResolvedValue([]) };
            mockFirebaseService.getFirestore.mockReturnValue(firestoreMock);

            const result = await controller.check();

            expect(result.maintenance).toBe(true);
        });

        it('should handle redis read/write check failure', async () => {
            mockUserRepository.count.mockResolvedValue(1);
            mockRedisService.set.mockResolvedValue('OK');
            mockRedisService.get.mockResolvedValueOnce('not-ok'); // For health check, simulate failure
            // The rest won't be called, but mock to avoid errors
            mockFirebaseService.getFirestore().listCollections.mockResolvedValue([]);

            const result = await controller.check();

            expect(result.status).toBe('error');
            expect(result.services.redis.status).toBe('error');
            expect(result.services.redis.message).toContain('Redis read/write check failed');
        });
    });

    describe('toggleMaintenance', () => {
        it('should enable maintenance mode', async () => {
            mockRedisService.set.mockResolvedValue('OK');

            const result = await controller.toggleMaintenance({
                enabled: true,
                message: 'Scheduled maintenance',
            });

            expect(result.success).toBe(true);
            expect(result.message).toBe('Maintenance mode enabled');
            expect(mockRedisService.set).toHaveBeenCalledTimes(2);
        });

        it('should disable maintenance mode', async () => {
            mockRedisService.set.mockResolvedValue('OK');

            const result = await controller.toggleMaintenance({
                enabled: false,
            });

            expect(result.success).toBe(true);
            expect(result.message).toBe('Maintenance mode disabled');
            expect(mockRedisService.set).toHaveBeenCalledTimes(1);
        });

        it('should handle errors when toggling maintenance mode', async () => {
            mockRedisService.set.mockRejectedValue(new Error('Redis error'));

            const result = await controller.toggleMaintenance({
                enabled: true,
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain('Failed to update maintenance mode');
        });

        it('should handle errors when toggling maintenance mode (no error.message)', async () => {
            // Simulate error without message property
            const error = {};
            mockRedisService.set.mockRejectedValue(error);
            const result = await controller.toggleMaintenance({ enabled: true });
            expect(result.success).toBe(false);
            expect(result.message).toContain('Failed to update maintenance mode');
        });
    });
});
