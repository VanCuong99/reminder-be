import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserService } from './user.service';
import { User } from '../../../domain/entities/user.entity';
import { createMockUser } from '../../../test/mocks/user.mock';
import { UserRole } from '../../../shared/constants/user-role.enum';
import { AuthProvider } from '../../../shared/constants/auth.constants';
import { ConfigService } from '@nestjs/config';
import { FirebaseService } from '../../../infrastructure/firestore/firebase.service';
import { NotificationService } from '../../../infrastructure/messaging/notification.service';
import { SocialAccount } from '../../../domain/entities/social-account.entity';
import { Logger } from '@nestjs/common';

describe('UserService - Update Login Metadata', () => {
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

    let service: UserService;
    let repository: jest.Mocked<Repository<User>>;
    let firebaseService: jest.Mocked<FirebaseService>;

    const mockUser = createMockUser({
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        role: UserRole.USER,
        lastLoginAt: new Date('2023-01-01'),
        lastLoginProvider: AuthProvider.LOCAL,
        loginCount: 5,
        lastUserAgent: 'Mozilla/5.0',
        lastLoginIp: '127.0.0.1',
        failedAttempts: 0,
    });

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UserService,
                {
                    provide: getRepositoryToken(User),
                    useValue: {
                        findOne: jest.fn(),
                        save: jest.fn(),
                        create: jest.fn(),
                    },
                },
                {
                    provide: getRepositoryToken(SocialAccount),
                    useValue: {
                        findOne: jest.fn(),
                        save: jest.fn(),
                        create: jest.fn(),
                    },
                },
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn(),
                    },
                },
                {
                    provide: FirebaseService,
                    useValue: {
                        updateDocument: jest.fn(),
                    },
                },
                {
                    provide: NotificationService,
                    useValue: {
                        sendNotificationToUser: jest.fn(),
                        broadcastNotification: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<UserService>(UserService);
        repository = module.get(getRepositoryToken(User));
        firebaseService = module.get(FirebaseService);
    });

    it('should update user login metadata successfully', async () => {
        const metadata = {
            lastLoginAt: new Date(),
            lastLoginProvider: AuthProvider.LOCAL,
            loginCount: 6,
            lastUserAgent: 'Chrome',
            lastLoginIp: '192.168.1.1',
        };

        repository.findOne.mockResolvedValue(mockUser);
        repository.save.mockResolvedValue({
            ...mockUser,
            ...metadata,
        });

        const result = await service.updateLoginMetadata(mockUser.id, metadata);

        expect(result).toBeDefined();
        expect(result.lastLoginAt).toBeDefined();
        expect(result.lastLoginProvider).toBe(AuthProvider.LOCAL);
        expect(result.loginCount).toBe(6);
        expect(result.lastUserAgent).toBe('Chrome');
        expect(result.lastLoginIp).toBe('192.168.1.1');

        expect(repository.findOne).toHaveBeenCalledWith({
            where: { id: mockUser.id },
        });
        expect(repository.save).toHaveBeenCalled();
        expect(firebaseService.updateDocument).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
        repository.findOne.mockResolvedValue(null);

        const metadata = {
            lastLoginAt: new Date(),
            lastLoginProvider: AuthProvider.LOCAL,
            loginCount: 1,
        };

        await expect(service.updateLoginMetadata('non-existent-id', metadata)).rejects.toThrow(
            'User with ID non-existent-id not found',
        );

        expect(repository.save).not.toHaveBeenCalled();
        expect(firebaseService.updateDocument).not.toHaveBeenCalled();
    });

    it('should handle Firebase update failure gracefully', async () => {
        const metadata = {
            lastLoginAt: new Date(),
            lastLoginProvider: AuthProvider.LOCAL,
            loginCount: 6,
        };

        repository.findOne.mockResolvedValue(mockUser);
        repository.save.mockResolvedValue({
            ...mockUser,
            ...metadata,
        });

        firebaseService.updateDocument.mockRejectedValue(new Error('Firebase update failed'));

        const result = await service.updateLoginMetadata(mockUser.id, metadata);

        expect(result).toBeDefined();
        expect(result.lastLoginAt).toBeDefined();
        expect(result.lastLoginProvider).toBe(AuthProvider.LOCAL);
        expect(result.loginCount).toBe(6);

        expect(repository.findOne).toHaveBeenCalledWith({
            where: { id: mockUser.id },
        });
        expect(repository.save).toHaveBeenCalled();
        expect(firebaseService.updateDocument).toHaveBeenCalled();
    });

    it('should update failed attempts count', async () => {
        const metadata = {
            lastLoginAt: new Date(),
            lastLoginProvider: AuthProvider.LOCAL,
            loginCount: 1,
            failedAttempts: 3,
        };

        repository.findOne.mockResolvedValue(mockUser);
        repository.save.mockResolvedValue({
            ...mockUser,
            ...metadata,
        });

        const result = await service.updateLoginMetadata(mockUser.id, metadata);

        expect(result).toBeDefined();
        expect(result.failedAttempts).toBe(3);

        expect(repository.findOne).toHaveBeenCalledWith({
            where: { id: mockUser.id },
        });
        expect(repository.save).toHaveBeenCalledWith(
            expect.objectContaining({
                ...mockUser,
                ...metadata,
            }),
        );
    });
});
