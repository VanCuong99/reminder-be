import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UserService } from '../users/user.service';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { JwtConfigService } from '../../../infrastructure/auth/services/jwt-config.service';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '../../../shared/constants/user-role.enum';
import { User } from '../../../domain/entities/user.entity';

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
    const mockUser: User = {
        id: '1',
        email: 'test@example.com',
        username: 'Test User',
        password: '', // use empty string for social login to satisfy type
        role: UserRole.USER,
        isActive: true,
        socialId: 'social-123',
        provider: 'google',
        timezone: 'UTC',
        notificationPrefs: {
            email: true,
            push: true,
            frequency: 'immediate',
        },
        deviceTokens: [],
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: UserService,
                    useValue: {
                        findByEmail: jest.fn(),
                        create: jest.fn(),
                    },
                },
                {
                    provide: JwtService,
                    useValue: {
                        sign: jest.fn().mockReturnValue('mock-token'),
                    },
                },
                {
                    provide: RedisService,
                    useValue: {
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
                        accessTokenExpiration: '1h',
                        refreshTokenExpiration: '7d',
                    },
                },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
        userService = module.get(UserService);
        jwtService = module.get(JwtService);
    });

    describe('socialLogin', () => {
        const mockSocialUser = {
            socialId: 'social-123',
            email: 'test@example.com',
            name: 'Test User',
            avatar: 'https://example.com/avatar.jpg',
            provider: 'google',
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
});
