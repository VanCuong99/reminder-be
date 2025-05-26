import { ExecutionContext, Logger, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { DirectJwtAuthGuard } from './direct-jwt-auth.guard';
import { UserService } from '../../../application/services/users/user.service';
import { RedisService } from '../../cache/redis.service';
import { ConfigService } from '@nestjs/config';
import { JwtConfigService } from '../services/jwt-config.service';
import { createMockUser } from '../../../test/mocks/user.mock';
import { SECONDS_PER_HOUR } from '../../../shared/constants/constants';

describe('DirectJwtAuthGuard', () => {
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
    let guard: DirectJwtAuthGuard;
    let userService: jest.Mocked<UserService>;
    let jwtService: jest.Mocked<JwtService>;
    let redisService: jest.Mocked<RedisService>;
    let configService: jest.Mocked<ConfigService>;
    let jwtConfigService: jest.Mocked<JwtConfigService>;
    let mockContext: jest.Mocked<ExecutionContext>;
    let mockRequest: any;

    const mockUser = createMockUser();
    const mockToken = 'mock.jwt.token';
    const mockPayload = {
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        jti: 'mock-token-id',
        csrf: 'mock-csrf-token',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + SECONDS_PER_HOUR, // 1 hour from now
    };

    beforeEach(async () => {
        mockContext = {
            switchToHttp: jest.fn().mockReturnValue({
                getRequest: jest.fn().mockReturnValue({}),
            }),
        } as unknown as jest.Mocked<ExecutionContext>;

        mockRequest = {
            headers: { authorization: 'Bearer ' + mockToken },
            cookies: {},
            query: {},
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DirectJwtAuthGuard,
                {
                    provide: UserService,
                    useValue: {
                        findById: jest.fn(),
                    },
                },
                {
                    provide: JwtService,
                    useValue: {
                        verify: jest.fn().mockReturnValue(mockPayload),
                    },
                },
                {
                    provide: RedisService,
                    useValue: {
                        get: jest.fn(),
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
                        publicKey: 'mock-public-key',
                        algorithm: 'RS256',
                        inspectToken: jest.fn().mockReturnValue({
                            parsed: mockPayload,
                            header: { alg: 'RS256', typ: 'JWT' },
                            isRS256: true,
                        }),
                        verifyToken: jest.fn().mockReturnValue(mockPayload),
                    },
                },
            ],
        }).compile();

        guard = module.get<DirectJwtAuthGuard>(DirectJwtAuthGuard);
        userService = module.get(UserService) as jest.Mocked<UserService>;
        redisService = module.get(RedisService) as jest.Mocked<RedisService>;
        jwtConfigService = module.get(JwtConfigService) as jest.Mocked<JwtConfigService>;

        // Default: userService.findById returns a valid user
        userService.findById.mockResolvedValue(mockUser);

        mockContext.switchToHttp().getRequest = jest.fn().mockReturnValue(mockRequest);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(guard).toBeDefined();
    });

    describe('canActivate', () => {
        it('should return true for valid token and active user', async () => {
            const result = await guard.canActivate(mockContext);

            expect(result).toBe(true);
            expect(jwtConfigService.inspectToken).toHaveBeenCalledWith(mockToken);
            expect(jwtConfigService.verifyToken).toHaveBeenCalledWith(mockToken);
            expect(userService.findById).toHaveBeenCalledWith('1');
            expect(redisService.get).toHaveBeenCalledWith('blacklist:1');
            expect(mockRequest.user).toEqual({
                ...mockUser,
                sub: mockPayload.sub,
                jti: mockPayload.jti,
                csrf: mockPayload.csrf,
            });
        });

        it('should throw UnauthorizedException if no token is present', async () => {
            mockRequest.headers.authorization = undefined;

            await expect(guard.canActivate(mockContext)).rejects.toThrow(
                new UnauthorizedException('Authentication token is missing'),
            );
        });

        it('should extract token from cookies when authorization header is missing', async () => {
            mockRequest.headers.authorization = undefined;
            mockRequest.cookies.access_token = mockToken;

            await guard.canActivate(mockContext);

            expect(jwtConfigService.inspectToken).toHaveBeenCalledWith(mockToken);
            expect(jwtConfigService.verifyToken).toHaveBeenCalledWith(mockToken);
        });

        it('should extract token from query params when authorization header and cookies are missing', async () => {
            mockRequest.headers.authorization = undefined;
            mockRequest.cookies = {};
            mockRequest.query = { access_token: mockToken };

            await guard.canActivate(mockContext);

            expect(jwtConfigService.inspectToken).toHaveBeenCalledWith(mockToken);
            expect(jwtConfigService.verifyToken).toHaveBeenCalledWith(mockToken);
        });

        it('should throw UnauthorizedException if token cannot be parsed', async () => {
            jwtConfigService.inspectToken.mockReturnValue({
                parsed: null,
                header: null,
                isRS256: false,
            });

            await expect(guard.canActivate(mockContext)).rejects.toThrow(
                new UnauthorizedException('Invalid token format'),
            );
        });

        it('should throw UnauthorizedException if token signature verification fails', async () => {
            const originalNodeEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';
            jwtConfigService.verifyToken.mockRejectedValue(new Error('Invalid signature'));

            await expect(guard.canActivate(mockContext)).rejects.toThrow(
                new UnauthorizedException('Invalid signature'),
            );
            process.env.NODE_ENV = originalNodeEnv;
        });

        it('should throw UnauthorizedException if user not found', async () => {
            userService.findById.mockResolvedValue(null);

            await expect(guard.canActivate(mockContext)).rejects.toThrow(
                new UnauthorizedException('User not found'),
            );
        });

        it('should throw UnauthorizedException if user account is inactive', async () => {
            userService.findById.mockResolvedValue({
                ...mockUser,
                isActive: false,
            });

            await expect(guard.canActivate(mockContext)).rejects.toThrow(
                new UnauthorizedException('User account is inactive'),
            );
        });

        it('should throw UnauthorizedException if token is blacklisted', async () => {
            redisService.get.mockResolvedValue(JSON.stringify(['mock-token-id']));

            await expect(guard.canActivate(mockContext)).rejects.toThrow(
                new UnauthorizedException('Token has been revoked'),
            );
        });

        it('should handle JSON parsing errors when checking blacklist', async () => {
            redisService.get.mockResolvedValue('invalid-json');

            // The guard should continue without throwing an error
            const result = await guard.canActivate(mockContext);

            expect(result).toBe(true);
        });

        it('should handle Redis errors when checking blacklist', async () => {
            redisService.get.mockRejectedValue(new Error('Redis connection error'));

            // The guard should continue without throwing an error
            const result = await guard.canActivate(mockContext);

            expect(result).toBe(true);
        });

        it('should extract token without Bearer prefix', async () => {
            mockRequest.headers.authorization = mockToken;

            await guard.canActivate(mockContext);

            expect(jwtConfigService.inspectToken).toHaveBeenCalledWith(mockToken);
        });

        it('should continue with unverified token data in non-production mode when verification fails', async () => {
            const originalNodeEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            jwtConfigService.verifyToken.mockRejectedValue(new Error('Verification failed'));

            const result = await guard.canActivate(mockContext);

            expect(result).toBe(true);

            // Restore original NODE_ENV
            process.env.NODE_ENV = originalNodeEnv;
        });

        it('should not continue with unverified token data in production mode when verification fails', async () => {
            const originalNodeEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            jwtConfigService.verifyToken.mockRejectedValue(new Error('Verification failed'));

            await expect(guard.canActivate(mockContext)).rejects.toThrow(
                new UnauthorizedException('Verification failed'),
            );

            // Restore original NODE_ENV
            process.env.NODE_ENV = originalNodeEnv;
        });

        it('should not call blacklist if payload.jti is missing', async () => {
            const payloadNoJti = { ...mockPayload };
            delete payloadNoJti.jti;
            jwtConfigService.inspectToken.mockReturnValue({
                parsed: payloadNoJti,
                header: { alg: 'HS256', typ: 'JWT' },
                isRS256: false,
            });
            jwtConfigService.verifyToken.mockResolvedValue(payloadNoJti);
            await guard.canActivate(mockContext);
            expect(redisService.get).not.toHaveBeenCalled();
        });

        it('should throw UnauthorizedException if payload.sub is missing', async () => {
            const payloadNoSub = { ...mockPayload };
            delete payloadNoSub.sub;
            jwtConfigService.inspectToken.mockReturnValue({
                parsed: payloadNoSub,
                header: { alg: 'HS256', typ: 'JWT' },
                isRS256: false,
            });
            jwtConfigService.verifyToken.mockResolvedValue(payloadNoSub);
            await expect(guard.canActivate(mockContext)).rejects.toThrow(
                new UnauthorizedException('Invalid token format'),
            );
        });

        it('should throw UnauthorizedException if inspectToken throws', async () => {
            jwtConfigService.inspectToken.mockImplementation(() => {
                throw new Error('inspect error');
            });
            await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException if verifyToken throws a non-Error', async () => {
            const originalNodeEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';
            jwtConfigService.verifyToken.mockRejectedValue('string error');
            await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
            process.env.NODE_ENV = originalNodeEnv;
        });
    });
});
