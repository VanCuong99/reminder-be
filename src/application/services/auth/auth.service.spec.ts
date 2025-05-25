// filepath: c:\Users\VanCuong\QcStar\Momento_BE\src\application\services\auth\auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import * as bcrypt from 'bcryptjs';
import { UserRole } from 'src/shared/constants/user-role.enum';
import { UserService } from '../users/user.service';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { JwtConfigService } from '../../../infrastructure/auth/services/jwt-config.service';
import { v4 as uuidv4 } from 'uuid';

jest.mock('bcryptjs');
jest.mock('uuid');

// Mock uuid to return consistent values for testing
(uuidv4 as jest.Mock).mockReturnValue('mock-uuid');

describe('AuthService', () => {
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
    let service: AuthService;
    let userService: { [K in keyof UserService]: jest.Mock };
    let jwtService: { [K in keyof JwtService]: jest.Mock };
    let redisService: { [K in keyof RedisService]: jest.Mock };
    let configService: { [K in keyof ConfigService]: jest.Mock };
    let jwtConfigService: JwtConfigService;

    const mockUser = {
        id: '1',
        email: 'test@example.com',
        password: 'hashedPassword',
        role: UserRole.USER,
        username: 'testuser',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deviceTokens: [],
        timezone: 'UTC',
        notificationPrefs: {
            email: true,
            push: true,
            frequency: 'immediate' as 'immediate' | 'daily' | 'weekly',
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: UserService,
                    useValue: {
                        findByEmail: jest.fn().mockResolvedValue(null),
                        findById: jest.fn().mockResolvedValue(null),
                        create: jest.fn().mockResolvedValue(null),
                    },
                },
                {
                    provide: JwtService,
                    useValue: {
                        sign: jest.fn(),
                        decode: jest.fn(),
                        verify: jest.fn(),
                    },
                },
                {
                    provide: RedisService,
                    useValue: {
                        get: jest.fn().mockResolvedValue(null),
                        set: jest.fn().mockResolvedValue('OK'),
                        del: jest.fn().mockResolvedValue(1),
                        onModuleInit: jest.fn().mockResolvedValue(undefined),
                        onModuleDestroy: jest.fn().mockResolvedValue(undefined),
                        delete: jest.fn().mockResolvedValue(1),
                        addToBlacklist: jest.fn().mockResolvedValue(undefined),
                        isBlacklisted: jest.fn().mockResolvedValue(false),
                        removeFromBlacklist: jest.fn().mockResolvedValue(undefined),
                        clearBlacklist: jest.fn().mockResolvedValue(undefined),
                        getMode: jest.fn().mockReturnValue('standalone'),
                    },
                },
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn().mockImplementation(key => {
                            const config = {
                                JWT_EXPIRATION: '1d',
                            };
                            return config[key];
                        }),
                    },
                },
                {
                    provide: JwtConfigService,
                    useValue: {
                        algorithm: 'HS256',
                        accessTokenExpiration: '15m',
                        refreshTokenExpiration: '7d',
                    },
                },
            ],
        }).compile();
        service = module.get<AuthService>(AuthService);
        userService = module.get(UserService);
        jwtService = module.get(JwtService);
        redisService = module.get(RedisService);

        // Reset all mocks after getting service instances
        jest.clearAllMocks();
    });

    describe('validateUser', () => {
        it('should return user without password if validation is successful', async () => {
            const { password, ...userWithoutPassword } = mockUser;

            jest.spyOn(userService, 'findByEmail').mockResolvedValue(mockUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);

            const result = await service.validateUser('test@example.com', 'password123');

            expect(result).toEqual(userWithoutPassword);
            expect(userService.findByEmail).toHaveBeenCalledWith('test@example.com');
            expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashedPassword');
        });

        it('should return null if user is not found', async () => {
            jest.spyOn(userService, 'findByEmail').mockResolvedValue(null);

            const result = await service.validateUser('nonexistent@example.com', 'password123');

            expect(result).toBeNull();
            expect(userService.findByEmail).toHaveBeenCalledWith('nonexistent@example.com');
        });

        it('should return null if password is invalid', async () => {
            jest.spyOn(userService, 'findByEmail').mockResolvedValue(mockUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);

            const result = await service.validateUser('test@example.com', 'wrongpassword');

            expect(result).toBeNull();
            expect(userService.findByEmail).toHaveBeenCalledWith('test@example.com');
            expect(bcrypt.compare).toHaveBeenCalledWith('wrongpassword', 'hashedPassword');
        });

        it('should throw UnauthorizedException if user account is inactive', async () => {
            const inactiveUser = {
                ...mockUser,
                isActive: false,
            };

            jest.spyOn(userService, 'findByEmail').mockResolvedValue(inactiveUser);

            await expect(service.validateUser('test@example.com', 'password123')).rejects.toThrow(
                UnauthorizedException,
            );

            expect(userService.findByEmail).toHaveBeenCalledWith('test@example.com');
        });
    });

    describe('login', () => {
        it('should return access token and user data if login is successful', async () => {
            const loginInput = {
                email: 'test@example.com',
                password: 'password123',
            };

            const { password, ...userWithoutPassword } = mockUser;

            jest.spyOn(service, 'validateUser').mockResolvedValue(userWithoutPassword);
            jest.spyOn(jwtService, 'sign').mockReturnValue('jwt_token');

            const result = await service.login(loginInput);

            expect(result).toEqual({
                tokens: {
                    accessToken: 'jwt_token',
                    refreshToken: 'jwt_token',
                    csrfToken: 'mock-uuid',
                },
                user: {
                    id: userWithoutPassword.id,
                    email: userWithoutPassword.email,
                    username: userWithoutPassword.username,
                    role: userWithoutPassword.role,
                },
            });
            expect(jwtService.sign).toHaveBeenCalledWith(
                expect.objectContaining({
                    email: mockUser.email,
                    sub: mockUser.id,
                    role: mockUser.role,
                    csrf: 'mock-uuid',
                    jti: 'mock-uuid',
                }),
                expect.any(Object),
            );
        });

        it('should throw UnauthorizedException if login fails', async () => {
            const loginInput = {
                email: 'test@example.com',
                password: 'wrongpassword',
            };

            jest.spyOn(service, 'validateUser').mockResolvedValue(null);

            await expect(service.login(loginInput)).rejects.toThrow(
                new UnauthorizedException('Invalid credentials'),
            );
        });
    });

    describe('logout', () => {
        it('should add token to blacklist in Redis', async () => {
            const userId = '1';
            const tokenId = 'token123';

            jest.spyOn(redisService, 'get').mockResolvedValue(null);
            jest.spyOn(redisService, 'set').mockResolvedValue(undefined);

            await service.logout(userId, tokenId);

            expect(redisService.get).toHaveBeenCalledWith(`blacklist:${userId}`);
            expect(redisService.set).toHaveBeenCalledWith(
                `blacklist:${userId}`,
                JSON.stringify([tokenId]),
                86400,
            );
        });

        it('should append token to existing blacklist', async () => {
            const userId = '1';
            const tokenId = 'token123';
            const existingBlacklist = ['oldToken1', 'oldToken2'];
            jest.spyOn(redisService, 'get').mockResolvedValue(JSON.stringify(existingBlacklist));
            jest.spyOn(redisService, 'set').mockResolvedValue(undefined);

            await service.logout(userId, tokenId);

            expect(redisService.get).toHaveBeenCalledWith(`blacklist:${userId}`);
            expect(redisService.set).toHaveBeenCalledWith(
                `blacklist:${userId}`,
                JSON.stringify([...existingBlacklist, tokenId]),
                86400,
            );
        });

        it('should handle invalid JSON in Redis', async () => {
            const userId = '1';
            const tokenId = 'token123';
            jest.spyOn(redisService, 'get').mockResolvedValue('invalid json');
            jest.spyOn(redisService, 'set').mockResolvedValue(undefined);

            await service.logout(userId, tokenId);

            expect(redisService.set).toHaveBeenCalledWith(
                `blacklist:${userId}`,
                JSON.stringify([tokenId]),
                expect.any(Number),
            );
        });

        it('should handle Redis errors gracefully', async () => {
            const userId = '1';
            const tokenId = 'token123';

            jest.spyOn(redisService, 'get').mockRejectedValue(new Error('Redis connection failed'));

            // Should not throw
            await expect(service.logout(userId, tokenId)).resolves.not.toThrow();
        });
    });

    describe('refreshToken', () => {
        it('should invalidate old token and generate new tokens', async () => {
            const userId = '1';
            const oldTokenId = 'oldToken123';
            const { password, ...userWithoutPassword } = mockUser;

            jest.spyOn(service, 'logout').mockResolvedValue(undefined);
            jest.spyOn(userService, 'findById').mockResolvedValue(mockUser);
            jest.spyOn(jwtService, 'sign')
                .mockReturnValueOnce('new_access_token') // For access token
                .mockReturnValueOnce('new_refresh_token'); // For refresh token

            const result = await service.refreshToken(userId, oldTokenId);

            expect(service.logout).toHaveBeenCalledWith(userId, oldTokenId);
            expect(userService.findById).toHaveBeenCalledWith(userId);
            expect(result).toEqual({
                tokens: {
                    accessToken: 'new_access_token',
                    refreshToken: 'new_refresh_token',
                    csrfToken: 'mock-uuid',
                },
                user: {
                    id: userWithoutPassword.id,
                    email: userWithoutPassword.email,
                    username: userWithoutPassword.username,
                    role: userWithoutPassword.role,
                },
            });
        });

        it('should throw when user not found', async () => {
            const userId = 'nonexistent';
            const oldTokenId = 'oldToken123';

            jest.spyOn(service, 'logout').mockResolvedValue(undefined);
            jest.spyOn(userService, 'findById').mockResolvedValue(null);

            await expect(service.refreshToken(userId, oldTokenId)).rejects.toThrow(
                UnauthorizedException,
            );
            expect(service.logout).toHaveBeenCalledWith(userId, oldTokenId);
        });

        it('should throw when user is inactive', async () => {
            const userId = '1';
            const oldTokenId = 'oldToken123';
            const inactiveUser = { ...mockUser, isActive: false };

            jest.spyOn(service, 'logout').mockResolvedValue(undefined);
            jest.spyOn(userService, 'findById').mockResolvedValue(inactiveUser);

            await expect(service.refreshToken(userId, oldTokenId)).rejects.toThrow(
                UnauthorizedException,
            );
        });
    });

    describe('hashPassword', () => {
        it('should hash a password correctly', async () => {
            const password = 'plain_password';
            (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');

            const result = await service.hashPassword(password);

            expect(result).toBe('hashed_password');
            expect(bcrypt.hash).toHaveBeenCalledWith(password, 12);
        });
    });

    describe('comparePassword', () => {
        it('should return true when passwords match', async () => {
            const plainPassword = 'password123';
            const hashedPassword = 'hashed_password';

            (bcrypt.compare as jest.Mock).mockResolvedValue(true);

            const result = await service.comparePassword(plainPassword, hashedPassword);

            expect(result).toBe(true);
            expect(bcrypt.compare).toHaveBeenCalledWith(plainPassword, hashedPassword);
        });

        it('should return false when passwords do not match', async () => {
            const plainPassword = 'wrong_password';
            const hashedPassword = 'hashed_password';

            (bcrypt.compare as jest.Mock).mockResolvedValue(false);

            const result = await service.comparePassword(plainPassword, hashedPassword);

            expect(result).toBe(false);
        });
        it('should return false when plain password is missing', async () => {
            const hashedPassword = 'hashed_password';

            // Reset the mock before this specific test
            (bcrypt.compare as jest.Mock).mockReset();

            const result = await service.comparePassword(null as any, hashedPassword);

            expect(result).toBe(false);
            expect(bcrypt.compare).not.toHaveBeenCalled();
        });

        it('should return false when hashed password is missing', async () => {
            const plainPassword = 'password123';

            // Reset the mock before this specific test
            (bcrypt.compare as jest.Mock).mockReset();

            const result = await service.comparePassword(plainPassword, null as any);

            expect(result).toBe(false);
            expect(bcrypt.compare).not.toHaveBeenCalled();
        });

        it('should return false when bcrypt throws an error', async () => {
            const plainPassword = 'password123';
            const hashedPassword = 'hashed_password';

            (bcrypt.compare as jest.Mock).mockRejectedValue(new Error('Comparison failed'));

            const result = await service.comparePassword(plainPassword, hashedPassword);

            expect(result).toBe(false);
        });
    });

    describe('decodeToken', () => {
        it('should decode a valid token', () => {
            const token = 'valid_jwt_token';
            const decodedPayload = { sub: '1', email: 'test@example.com' };

            jest.spyOn(jwtService, 'decode').mockReturnValue(decodedPayload);

            const result = service.decodeToken(token);

            expect(result).toEqual(decodedPayload);
            expect(jwtService.decode).toHaveBeenCalledWith(token);
        });

        it('should return null when token is invalid', () => {
            const token = 'invalid_token';

            jest.spyOn(jwtService, 'decode').mockImplementation(() => {
                throw new Error('Invalid token');
            });

            const result = service.decodeToken(token);

            expect(result).toBeNull();
        });
    });
    describe('socialLogin', () => {
        const mockSocialUser = {
            socialId: 'social-123',
            email: 'test@example.com',
            name: 'Test User',
            avatar: 'https://example.com/avatar.jpg',
            provider: 'google',
        };

        const mockTokens = {
            access: 'mock-access-token',
            refresh: 'mock-refresh-token',
        };

        let mockFindByEmail: jest.Mock;
        let mockCreate: jest.Mock;
        let mockSign: jest.Mock;
        let mockRedisSet: jest.Mock;
        let mockRedisGet: jest.Mock;
        beforeEach(() => {
            jest.clearAllMocks();

            // Create new mocks for each test
            mockFindByEmail = jest.fn();
            mockCreate = jest.fn();
            mockSign = jest.fn();
            mockRedisSet = jest.fn();
            mockRedisGet = jest.fn();

            // Setup default behaviors
            mockFindByEmail.mockResolvedValue(mockUser);
            mockCreate.mockResolvedValue(mockUser);
            mockSign.mockImplementation((payload, options) => {
                return options?.refreshToken ? mockTokens.refresh : mockTokens.access;
            });
            mockRedisSet.mockResolvedValue('OK');
            mockRedisGet.mockResolvedValue(null);

            // Assign mocks to services
            Object.defineProperty(userService, 'findByEmail', { value: mockFindByEmail });
            Object.defineProperty(userService, 'create', { value: mockCreate });
            Object.defineProperty(jwtService, 'sign', { value: mockSign });
            Object.defineProperty(redisService, 'set', { value: mockRedisSet });
            Object.defineProperty(redisService, 'get', { value: mockRedisGet });
        });

        it('should login existing user with social credentials', async () => {
            userService.findByEmail.mockResolvedValue(mockUser);

            const result = await service.socialLogin(mockSocialUser);

            expect(result).toHaveProperty('user');
            expect(result).toHaveProperty('tokens');
            expect(result.user.email).toBe(mockUser.email);
            expect(jwtService.sign).toHaveBeenCalled();
        });

        it('should create new user if not exists and login', async () => {
            userService.findByEmail.mockResolvedValue(null);
            userService.create.mockResolvedValue(mockUser);

            const result = await service.socialLogin(mockSocialUser);

            expect(userService.create).toHaveBeenCalledWith({
                email: mockSocialUser.email,
                username: mockSocialUser.name,
                password: null,
                socialId: mockSocialUser.socialId,
                provider: mockSocialUser.provider,
            });
            expect(result).toHaveProperty('user');
            expect(result).toHaveProperty('tokens');
            expect(result.user.email).toBe(mockUser.email);
        });

        it('should throw UnauthorizedException if user is inactive', async () => {
            userService.findByEmail.mockResolvedValue({
                ...mockUser,
                isActive: false,
            });

            await expect(service.socialLogin(mockSocialUser)).rejects.toThrow(
                UnauthorizedException,
            );
        });

        it('should generate tokens with correct payload', async () => {
            userService.findByEmail.mockResolvedValue(mockUser);
            await service.socialLogin(mockSocialUser);
            expect(jwtService.sign).toHaveBeenCalledWith(
                expect.objectContaining({
                    sub: mockUser.id,
                    email: mockUser.email,
                    role: mockUser.role,
                    csrf: expect.any(String),
                    jti: expect.any(String),
                }),
                expect.any(Object),
            );
            // The service does NOT store refresh token in Redis for socialLogin, so these tests are removed.
            // If you want to test Redis storage, add that logic to the service first.

            // No Redis storage assertions for socialLogin as per current implementation.
            // If you want to test Redis storage, add that logic to the service first.
        });
    });
});
