import { Test, TestingModule } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from 'src/application/services/auth/auth.service';
import { AuthController } from 'src/presentation/controllers/auth.controller';

import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from 'src/domain/entities/user.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './strategies/jwt.strategy';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { UserService } from 'src/application/services/users/user.service';
import { UserRole } from 'src/shared/constants/user-role.enum';
import { TokenValidationService } from '../../shared/services/token-validation.service';

const { TimezoneService } = require('../../shared/services/timezone.service');

describe('AuthModule', () => {
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
    let module: TestingModule;
    let authService: AuthService;
    let authController: AuthController;
    let jwtStrategy: JwtStrategy;
    let jwtService: JwtService;

    // Mock repositories and services
    const mockUserRepository = {
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
        findOneBy: jest.fn(),
    };

    // Mock ConfigService
    const mockConfigService = {
        get: jest.fn().mockImplementation((key: string) => {
            if (key === 'JWT_SECRET') return 'test-jwt-secret';
            if (key === 'JWT_EXPIRATION') return '1h';
            return null;
        }),
    };

    // Mock UserService
    const mockUserService = {
        findOneByEmail: jest.fn(), // legacy, not used
        findOne: jest.fn(), // legacy, not used
        create: jest.fn(),
        findByEmail: jest.fn(),
        findById: jest.fn(),
    };

    beforeEach(async () => {
        module = await Test.createTestingModule({
            imports: [PassportModule.register({ defaultStrategy: 'jwt' }), ConfigModule],
            providers: [
                {
                    provide: TokenValidationService,
                    useValue: {
                        validateFirebaseToken: jest.fn(),
                        extractTokenFromRequest: jest.fn(),
                        // Patch: handleAuthResponse mock that sets cookies
                        handleAuthResponse: jest.fn((res, authResponse, provider) => {
                            if (res.cookie) {
                                res.cookie(
                                    'access_token',
                                    authResponse.tokens?.accessToken,
                                    expect.any(Object),
                                );
                                res.cookie(
                                    'refresh_token',
                                    authResponse.tokens?.refreshToken,
                                    expect.any(Object),
                                );
                            }
                            return {
                                user: authResponse.user,
                                accessToken: authResponse.tokens?.accessToken,
                                refreshToken: authResponse.tokens?.refreshToken,
                                csrfToken: authResponse.tokens?.csrfToken,
                                message: 'Login successful',
                            };
                        }),
                    },
                },
                {
                    provide: TimezoneService,
                    useValue: {
                        DEFAULT_TIMEZONE: 'UTC',
                        isValidTimezone: jest.fn(() => true),
                    },
                },
                AuthService,
                JwtService,
                JwtStrategy,
                {
                    provide: getRepositoryToken(User),
                    useValue: mockUserRepository,
                },
                {
                    provide: UserService,
                    useValue: mockUserService,
                },
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
                {
                    provide: require('../../infrastructure/cache/redis.service').RedisService,
                    useValue: {
                        get: jest.fn(),
                        set: jest.fn(),
                        delete: jest.fn(),
                        addToBlacklist: jest.fn(),
                        isBlacklisted: jest.fn(),
                        onModuleInit: jest.fn(),
                        onModuleDestroy: jest.fn(),
                        getMode: jest.fn(() => 'mock'),
                        isAvailable: jest.fn(() => true),
                    },
                },
                {
                    provide: require('../../infrastructure/auth/services/jwt-config.service')
                        .JwtConfigService,
                    useValue: {
                        secretOrPublicKey: 'test-jwt-secret',
                        algorithm: 'HS256',
                        accessTokenExpiration: '1h',
                        refreshTokenExpiration: '7d',
                    },
                },
            ],
            controllers: [AuthController],
        }).compile();

        authService = module.get<AuthService>(AuthService);
        authController = module.get<AuthController>(AuthController);
        jwtService = module.get<JwtService>(JwtService);
        jwtStrategy = module.get<JwtStrategy>(JwtStrategy);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Module initialization', () => {
        it('should compile the AuthModule', () => {
            expect(module).toBeDefined();
        });

        it('should have AuthService provider', () => {
            expect(authService).toBeDefined();
        });

        it('should have AuthController provider', () => {
            expect(authController).toBeDefined();
        });

        it('should have JwtStrategy provider', () => {
            expect(jwtStrategy).toBeDefined();
        });

        it('should have JwtService provider', () => {
            expect(jwtService).toBeDefined();
        });
    });

    describe('AuthService', () => {
        it('should validate user with correct credentials', async () => {
            const mockUser = {
                id: '1',
                email: 'test@example.com',
                password: 'hashedPassword',
                role: UserRole.USER,
                isActive: true,
            };
            mockUserService.findByEmail.mockResolvedValue(mockUser);
            jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
            jest.spyOn(jwtService, 'sign').mockReturnValue('mocked-jwt-token');

            const result = await authService.login({
                email: 'test@example.com',
                password: 'password',
            });

            expect(mockUserService.findByEmail).toHaveBeenCalledWith('test@example.com');
            expect(jwtService.sign).toHaveBeenCalled();
            expect(result).toEqual({
                tokens: {
                    accessToken: 'mocked-jwt-token',
                    refreshToken: 'mocked-jwt-token',
                    csrfToken: expect.any(String),
                },
                user: expect.objectContaining({
                    id: '1',
                    email: 'test@example.com',
                }),
            });
        });

        it('should throw error with incorrect credentials', async () => {
            const mockUser = {
                id: '1',
                email: 'test@example.com',
                password: 'hashedPassword',
                role: UserRole.USER,
                isActive: true,
            };
            mockUserService.findByEmail.mockResolvedValue(mockUser);
            jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));

            await expect(
                authService.login({
                    email: 'test@example.com',
                    password: 'wrong-password',
                }),
            ).rejects.toThrow(UnauthorizedException);
        });

        it('should throw error when user not found', async () => {
            mockUserService.findByEmail.mockResolvedValue(null);

            await expect(
                authService.login({
                    email: 'nonexistent@example.com',
                    password: 'password',
                }),
            ).rejects.toThrow(UnauthorizedException);
        });
    });

    describe('JwtStrategy', () => {
        it('should validate JWT payload and return user', async () => {
            const mockActiveUser = {
                id: '1',
                email: 'test@example.com',
                role: UserRole.USER,
                isActive: true,
            };
            const payload = { sub: '1', email: 'test@example.com' };
            mockUserService.findById.mockResolvedValue(mockActiveUser);

            // Mock request object
            const mockReq = { method: 'GET', headers: {}, get: () => null } as any;
            const validateResult = await jwtStrategy.validate(mockReq, payload);

            expect(validateResult).toMatchObject({
                ...mockActiveUser,
                sub: '1',
                jti: undefined,
                csrf: undefined,
            });
            expect(mockUserService.findById).toHaveBeenCalledWith('1');
        });

        it('should throw UnauthorizedException when user is inactive', async () => {
            const mockInactiveUser = {
                id: '1',
                email: 'test@example.com',
                role: UserRole.USER,
                isActive: false,
            };
            const payload = { sub: '1', email: 'test@example.com' };
            mockUserService.findById.mockResolvedValue(mockInactiveUser);

            const mockReq = { method: 'GET', headers: {}, get: () => null } as any;
            await expect(jwtStrategy.validate(mockReq, payload)).rejects.toThrow(
                UnauthorizedException,
            );
            expect(mockUserService.findById).toHaveBeenCalledWith('1');
        });
    });

    describe('AuthController', () => {
        it('should call AuthService login method', async () => {
            // Mock Request object with user property
            const mockRequest = {
                user: {
                    id: '1',
                    email: 'test@example.com',
                    username: 'testuser',
                    role: UserRole.USER,
                    isActive: true,
                },
            };

            // Mock Response object
            const mockResponse = {
                cookie: jest.fn().mockReturnThis(),
            };

            const authServiceResult = {
                user: {
                    id: '1',
                    email: 'test@example.com',
                    username: 'testuser',
                    role: UserRole.USER,
                    isActive: true,
                },
                tokens: {
                    accessToken: 'mocked-jwt-token',
                    refreshToken: 'refresh_token_placeholder',
                    csrfToken: 'csrf-token',
                },
            };

            // Create a mock LoginDto
            const mockLoginDto = {
                email: 'test@example.com',
                password: 'password123',
            };

            jest.spyOn(authService, 'login').mockResolvedValue(authServiceResult);

            const result = await authController.login(
                mockLoginDto,
                mockRequest as any,
                mockResponse as any,
            );

            expect(authService.login).toHaveBeenCalledWith(mockLoginDto);
            expect(result).toEqual({
                user: authServiceResult.user,
                csrfToken: authServiceResult.tokens.csrfToken,
                message: 'Login successful',
                accessToken: authServiceResult.tokens.accessToken,
                refreshToken: authServiceResult.tokens.refreshToken,
            });
            expect(mockResponse.cookie).toHaveBeenCalledTimes(2); // Checking that cookies were set
        });
    });
});
