import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { DeviceTokenService } from './device-token.service';
import { DeviceToken } from '../../../domain/entities/device-token.entity';
import { BadRequestException, Logger } from '@nestjs/common';

describe('DeviceTokenService', () => {
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
    let service: DeviceTokenService;
    let repository: Repository<DeviceToken>;
    let configService: ConfigService;

    const mockUser = {
        id: '1',
        email: 'test@example.com',
    };

    const mockValidToken = 'test_valid_token';
    // Updated mock production token to match FCM format with 164 characters (within 140-200 range)
    const mockProductionToken =
        'fMEfq1sxQWeqsfS2fMEfq1sxQWeqsfS2fMEfq1sxQWeqsfS2fMEfq1sxQWeqsfS2fMEfq1sxQWeqsfS2fMEfq1sxQWeqsfS2fMEfq1sxQWeqsfS2fMEfq1sxQWeqsfS2fMEfq1sxQWeqsfS2';

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DeviceTokenService,
                {
                    provide: getRepositoryToken(DeviceToken),
                    useValue: {
                        findOne: jest.fn(),
                        find: jest.fn(),
                        create: jest.fn(),
                        save: jest.fn(),
                        update: jest.fn(),
                    },
                },
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<DeviceTokenService>(DeviceTokenService);
        repository = module.get<Repository<DeviceToken>>(getRepositoryToken(DeviceToken));
        configService = module.get<ConfigService>(ConfigService);
    });

    describe('validateFcmToken (private)', () => {
        it('should accept token with length 140-200 in production mode', () => {
            jest.spyOn(configService, 'get').mockReturnValue('production');
            // @ts-ignore: access private method
            const validToken = 'a'.repeat(140);
            expect(service['validateFcmToken'](validToken)).toBe(true);
            const validToken2 = 'a'.repeat(200);
            expect(service['validateFcmToken'](validToken2)).toBe(true);
        });

        it('should reject token with length < 140 or > 200 in production mode', () => {
            jest.spyOn(configService, 'get').mockReturnValue('production');
            // @ts-ignore: access private method
            expect(service['validateFcmToken']('a'.repeat(139))).toBe(false);
            expect(service['validateFcmToken']('a'.repeat(201))).toBe(false);
        });
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('saveToken', () => {
        it('should save a new device token in test mode', async () => {
            jest.spyOn(configService, 'get').mockReturnValue('test');
            jest.spyOn(repository, 'findOne').mockResolvedValue(null);
            jest.spyOn(repository, 'create').mockReturnValue({
                user: mockUser,
                token: mockValidToken,
                deviceType: 'ios',
                userId: mockUser.id,
            } as DeviceToken);
            jest.spyOn(repository, 'save').mockResolvedValue({
                user: mockUser,
                token: mockValidToken,
                deviceType: 'ios',
                userId: mockUser.id,
                isActive: true,
            } as DeviceToken);

            const result = await service.saveToken(mockUser as any, mockValidToken, 'ios');
            expect(result.isActive).toBe(true);
            expect(result.token).toBe(mockValidToken);
            expect(repository.save).toHaveBeenCalled();
        });

        it('should update existing device token', async () => {
            jest.spyOn(configService, 'get').mockReturnValue('test');
            const existingToken = {
                user: mockUser,
                token: mockValidToken,
                deviceType: 'ios',
                userId: mockUser.id,
                isActive: false,
            } as DeviceToken;

            jest.spyOn(repository, 'findOne').mockResolvedValue(existingToken);
            jest.spyOn(repository, 'save').mockResolvedValue({
                ...existingToken,
                isActive: true,
            });

            const result = await service.saveToken(mockUser as any, mockValidToken, 'ios');
            expect(result.isActive).toBe(true);
            expect(repository.save).toHaveBeenCalledWith({
                ...existingToken,
                isActive: true,
            });
        });

        it('should validate production token format', async () => {
            jest.spyOn(configService, 'get').mockReturnValue('production');
            // Mock repository.findOne to return null so a new token is created
            jest.spyOn(repository, 'findOne').mockResolvedValue(null);
            // Mock repository.create to return a new token object
            jest.spyOn(repository, 'create').mockReturnValue({
                user: mockUser,
                token: mockProductionToken,
                deviceType: 'ios',
                userId: mockUser.id,
            } as DeviceToken);
            // Mock repository.save to return the saved token
            jest.spyOn(repository, 'save').mockResolvedValue({
                user: mockUser,
                token: mockProductionToken,
                deviceType: 'ios',
                userId: mockUser.id,
                isActive: true,
            } as DeviceToken);

            await expect(
                service.saveToken(mockUser as any, 'invalid_token', 'ios'),
            ).rejects.toThrow(BadRequestException);

            await expect(
                service.saveToken(mockUser as any, mockProductionToken, 'ios'),
            ).resolves.not.toThrow();
        });
    });

    describe('deactivateToken', () => {
        it('should deactivate a token', async () => {
            jest.spyOn(repository, 'update').mockResolvedValue({} as any);

            await service.deactivateToken(mockValidToken);
            expect(repository.update).toHaveBeenCalledWith(
                { token: mockValidToken },
                { isActive: false },
            );
        });
    });

    describe('getUserActiveTokens', () => {
        it('should return active tokens for a user', async () => {
            const mockTokens = [
                { token: 'token1', isActive: true },
                { token: 'token2', isActive: true },
            ];

            jest.spyOn(repository, 'find').mockResolvedValue(mockTokens as DeviceToken[]);

            const result = await service.getUserActiveTokens(mockUser.id);
            expect(result).toEqual(mockTokens);
            expect(repository.find).toHaveBeenCalledWith({
                where: { userId: mockUser.id, isActive: true },
                relations: ['user'],
            });
        });
    });

    describe('getAllActiveTokens', () => {
        it('should return all active tokens', async () => {
            const mockTokens = [
                { token: 'token1', isActive: true },
                { token: 'token2', isActive: true },
            ];

            jest.spyOn(repository, 'find').mockResolvedValue(mockTokens as DeviceToken[]);

            const result = await service.getAllActiveTokens();
            expect(result).toEqual(mockTokens);
            expect(repository.find).toHaveBeenCalledWith({
                where: { isActive: true },
                relations: ['user'],
            });
        });
    });

    describe('getTokensForMultipleUsers', () => {
        it('should return an empty array if no userIds are provided', async () => {
            const result = await service.getTokensForMultipleUsers([]);
            expect(result).toEqual([]);
            expect(repository.find).not.toHaveBeenCalled();
        });

        it('should call repository.find with correct query for multiple userIds', async () => {
            const userIds = ['1', '2', '3'];
            const mockTokens = [
                { token: 'token1', userId: '1', isActive: true },
                { token: 'token2', userId: '2', isActive: true },
            ];
            jest.spyOn(repository, 'find').mockResolvedValue(mockTokens as DeviceToken[]);

            const result = await service.getTokensForMultipleUsers(userIds);
            expect(result).toEqual(mockTokens);
            expect(repository.find).toHaveBeenCalledWith({
                where: {
                    userId: expect.any(Object), // In(userIds) is an object
                    isActive: true,
                },
                relations: ['user'],
            });
        });
    });
});
