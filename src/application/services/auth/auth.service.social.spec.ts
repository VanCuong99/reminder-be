import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UserService } from '../users/user.service';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { JwtConfigService } from '../../../infrastructure/auth/services/jwt-config.service';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '../../../shared/constants/user-role.enum';
import { createMockUser } from '../../../test/mocks/user.mock';
import { AuthProvider, AUTH_CONSTANTS } from '../../../shared/constants/auth.constants';

describe('AuthService - Social Login', () => {
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
    let userService: jest.Mocked<UserService>;
    let jwtService: jest.Mocked<JwtService>;
    let redisService: jest.Mocked<RedisService>;
    let configService: jest.Mocked<ConfigService>;
    let jwtConfigService: jest.Mocked<JwtConfigService>;

    const mockUser = createMockUser({
        email: 'test@example.com',
        username: 'Test User',
        password: '', // empty string for social login
        role: UserRole.USER,
    });

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: UserService,
                    useValue: {
                        findBySocialId: jest.fn(),
                        findByEmail: jest.fn(),
                        create: jest.fn(),
                        linkSocialAccount: jest.fn(),
                        updateLoginMetadata: jest.fn().mockResolvedValue(mockUser),
                    },
                },
                {
                    provide: JwtService,
                    useValue: {
                        sign: jest.fn(),
                        decode: jest.fn(),
                    },
                },
                {
                    provide: RedisService,
                    useValue: {
                        get: jest.fn(),
                        set: jest.fn(),
                    },
                },
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn(),
                    },
                },
                {
                    provide: JwtConfigService,
                    useValue: {
                        algorithm: 'RS256',
                        accessTokenExpiration: '15m',
                        refreshTokenExpiration: '7d',
                    },
                },
            ],
        }).compile();
        service = module.get(AuthService);
        userService = module.get(UserService);
        jwtService = module.get(JwtService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('socialLogin', () => {
        const mockSocialUser = {
            socialId: 'social-123',
            email: 'test@example.com',
            name: 'Test User',
            avatar: 'https://example.com/avatar.jpg',
            provider: AuthProvider.GOOGLE,
        };

        it('should login existing user with social credentials', async () => {
            userService.findByEmail.mockResolvedValue(mockUser);

            const result = await service.socialLogin(mockSocialUser);

            expect(result).toHaveProperty('user');
            expect(result).toHaveProperty('tokens');
            expect(result.user.email).toBe(mockUser.email);
            expect(jwtService.sign).toHaveBeenCalled();
        });

        it('should create new user if not exists and login', async () => {
            // Type-safe workaround: undefined instead of null for not found
            userService.findByEmail.mockResolvedValue(undefined as any);
            userService.create.mockResolvedValue(mockUser);

            const result = await service.socialLogin(mockSocialUser);

            expect(userService.create).toHaveBeenCalledWith({
                email: mockSocialUser.email,
                username: mockSocialUser.name,
                password: null,
                socialId: mockSocialUser.socialId,
                provider: mockSocialUser.provider,
                avatar: mockSocialUser.avatar,
            });
            expect(result).toHaveProperty('user');
            expect(result).toHaveProperty('tokens');
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
                }),
                expect.any(Object),
            );
        });
    });

    describe('login metadata updates', () => {
        it('should update login metadata for existing user during social login', async () => {
            const existingUser = {
                ...mockUser,
                loginCount: 5,
                lastLoginAt: new Date('2023-01-01'),
            };
            userService.findByEmail.mockResolvedValue(existingUser);
            userService.updateLoginMetadata.mockResolvedValue({
                ...existingUser,
                loginCount: 6,
                lastLoginAt: expect.any(Date),
                lastLoginProvider: AuthProvider.GOOGLE,
                failedAttempts: AUTH_CONSTANTS.DEFAULT_VALUES.FAILED_ATTEMPTS,
            });

            await service.socialLogin({
                socialId: 'social-123',
                email: 'test@example.com',
                name: 'Test User',
                provider: AuthProvider.GOOGLE,
            });

            expect(userService.updateLoginMetadata).toHaveBeenCalledWith(
                existingUser.id,
                expect.objectContaining({
                    lastLoginProvider: AuthProvider.GOOGLE,
                    loginCount: 6,
                    lastLoginAt: expect.any(Date),
                }),
            );
        });

        it('should initialize login metadata for new user during social login', async () => {
            userService.findByEmail.mockResolvedValue(null);
            const newUser = {
                ...mockUser,
                id: 'new-user-id',
                loginCount: 0,
            };
            userService.create.mockResolvedValue(newUser);
            userService.updateLoginMetadata.mockResolvedValue({
                ...newUser,
                loginCount: 1,
                lastLoginAt: expect.any(Date),
                lastLoginProvider: AuthProvider.GOOGLE,
            });

            await service.socialLogin({
                socialId: 'social-123',
                email: 'newuser@example.com',
                name: 'New User',
                provider: AuthProvider.GOOGLE,
            });

            expect(userService.create).toHaveBeenCalled();
            expect(userService.updateLoginMetadata).toHaveBeenCalledWith(
                'new-user-id',
                expect.objectContaining({
                    lastLoginProvider: AuthProvider.GOOGLE,
                    loginCount: 1,
                    lastLoginAt: expect.any(Date),
                }),
            );
        });

        it('should handle login metadata update failure gracefully', async () => {
            userService.findByEmail.mockResolvedValue(mockUser);
            userService.updateLoginMetadata.mockRejectedValue(new Error('Update failed'));
            const result = await service.socialLogin({
                socialId: 'social-123',
                email: 'test@example.com',
                name: 'Test User',
                provider: AuthProvider.GOOGLE,
            });

            // Should still complete login successfully even if metadata update fails
            expect(result).toHaveProperty('user');
            expect(result).toHaveProperty('tokens');
            expect(loggerErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to update login metadata'),
            );
        });
    });
});
