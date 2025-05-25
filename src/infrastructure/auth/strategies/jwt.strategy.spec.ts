import { Test, TestingModule } from '@nestjs/testing';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { UserService } from '../../../application/services/users/user.service';
import { UserRole } from '../../../shared/constants/user-role.enum';
import { RedisService } from '../../cache/redis.service';
import { JwtConfigService } from '../services/jwt-config.service';

describe('JwtStrategy', () => {
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

    let jwtStrategy: JwtStrategy;
    let userService: UserService;
    let redisService: RedisService;

    const mockUser = {
        id: '1',
        email: 'test@example.com',
        role: UserRole.USER,
        isActive: true,
        username: 'testuser',
        password: 'hashedpassword',
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

    const mockJwtPayload = {
        sub: '1',
        email: 'test@example.com',
        role: UserRole.USER,
        jti: 'token-id-123',
        csrf: 'csrf-token-123',
    };

    const mockRequest = {
        method: 'GET',
        headers: {
            'x-csrf-token': 'csrf-token-123',
        },
    };

    beforeEach(async () => {
        // Mock JwtConfigService with required properties
        const mockJwtConfigService = {
            secretOrPublicKey: 'test-secret',
            algorithm: 'HS256',
        };
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                JwtStrategy,
                {
                    provide: JwtConfigService,
                    useValue: mockJwtConfigService,
                },
                {
                    provide: UserService,
                    useValue: {
                        findById: jest.fn(),
                    },
                },
                {
                    provide: RedisService,
                    useValue: {
                        get: jest.fn(),
                    },
                },
            ],
        })
            .overrideProvider(JwtConfigService)
            .useValue(mockJwtConfigService)
            .compile();

        jwtStrategy = module.get<JwtStrategy>(JwtStrategy);
        userService = module.get<UserService>(UserService);
        redisService = module.get<RedisService>(RedisService);
    });

    describe('validate', () => {
        it('should validate and return the user if token is valid', async () => {
            jest.spyOn(userService, 'findById').mockResolvedValue(mockUser);
            jest.spyOn(redisService, 'get').mockResolvedValue(null);

            const result = await jwtStrategy.validate(mockRequest as any, mockJwtPayload);

            expect(result).toEqual({
                ...mockUser,
                sub: mockJwtPayload.sub,
                jti: mockJwtPayload.jti,
                csrf: mockJwtPayload.csrf,
            });
            expect(userService.findById).toHaveBeenCalledWith('1');
        });

        it('should throw UnauthorizedException if user is inactive', async () => {
            const inactiveUser = {
                ...mockUser,
                isActive: false,
            };
            jest.spyOn(userService, 'findById').mockResolvedValue(inactiveUser);
            jest.spyOn(redisService, 'get').mockResolvedValue(null);

            await expect(jwtStrategy.validate(mockRequest as any, mockJwtPayload)).rejects.toThrow(
                UnauthorizedException,
            );
            expect(userService.findById).toHaveBeenCalledWith('1');
        });

        it('should throw UnauthorizedException if user does not exist', async () => {
            jest.spyOn(userService, 'findById').mockResolvedValue(null);
            jest.spyOn(redisService, 'get').mockResolvedValue(null);

            await expect(jwtStrategy.validate(mockRequest as any, mockJwtPayload)).rejects.toThrow(
                UnauthorizedException,
            );
            expect(userService.findById).toHaveBeenCalledWith('1');
        });

        it('should throw UnauthorizedException if token is blacklisted', async () => {
            jest.spyOn(userService, 'findById').mockResolvedValue(mockUser);
            jest.spyOn(redisService, 'get').mockResolvedValue(JSON.stringify(['token-id-123']));

            await expect(jwtStrategy.validate(mockRequest as any, mockJwtPayload)).rejects.toThrow(
                UnauthorizedException,
            );
            expect(redisService.get).toHaveBeenCalledWith('blacklist:1');
        });

        it('should throw UnauthorizedException if CSRF token is invalid for non-GET requests', async () => {
            jest.spyOn(userService, 'findById').mockResolvedValue(mockUser);
            jest.spyOn(redisService, 'get').mockResolvedValue(null);

            const requestWithInvalidCsrf = {
                method: 'POST',
                headers: {
                    'x-csrf-token': 'invalid-csrf-token',
                    'user-agent': 'Mozilla/5.0',
                },
                get: jest.fn().mockReturnValue('https://example.com'),
            };

            await expect(
                jwtStrategy.validate(requestWithInvalidCsrf as any, mockJwtPayload),
            ).rejects.toThrow(UnauthorizedException);
        });

        it('should skip CSRF check for API clients (PostmanRuntime)', async () => {
            jest.spyOn(userService, 'findById').mockResolvedValue(mockUser);
            jest.spyOn(redisService, 'get').mockResolvedValue(null);

            const requestWithApiClient = {
                method: 'POST',
                headers: {
                    'x-csrf-token': 'invalid-csrf-token',
                    'user-agent': 'PostmanRuntime',
                },
                get: jest.fn().mockReturnValue(null),
            };

            const result = await jwtStrategy.validate(requestWithApiClient as any, mockJwtPayload);
            expect(result).toEqual({
                ...mockUser,
                sub: mockJwtPayload.sub,
                jti: mockJwtPayload.jti,
                csrf: mockJwtPayload.csrf,
            });
        });

        it('should skip CSRF check for API clients (Swagger)', async () => {
            jest.spyOn(userService, 'findById').mockResolvedValue(mockUser);
            jest.spyOn(redisService, 'get').mockResolvedValue(null);

            const requestWithApiClient = {
                method: 'POST',
                headers: {
                    'x-csrf-token': 'invalid-csrf-token',
                    'user-agent': 'Swagger',
                },
                get: jest.fn().mockReturnValue(null),
            };

            const result = await jwtStrategy.validate(requestWithApiClient as any, mockJwtPayload);
            expect(result).toEqual({
                ...mockUser,
                sub: mockJwtPayload.sub,
                jti: mockJwtPayload.jti,
                csrf: mockJwtPayload.csrf,
            });
        });

        it('should skip CSRF check for API clients (no origin)', async () => {
            jest.spyOn(userService, 'findById').mockResolvedValue(mockUser);
            jest.spyOn(redisService, 'get').mockResolvedValue(null);

            const requestWithNoOrigin = {
                method: 'POST',
                headers: {
                    'x-csrf-token': 'invalid-csrf-token',
                    'user-agent': 'Mozilla/5.0',
                },
                get: jest.fn().mockReturnValue(null),
            };

            const result = await jwtStrategy.validate(requestWithNoOrigin as any, mockJwtPayload);
            expect(result).toEqual({
                ...mockUser,
                sub: mockJwtPayload.sub,
                jti: mockJwtPayload.jti,
                csrf: mockJwtPayload.csrf,
            });
        });
    });
});
