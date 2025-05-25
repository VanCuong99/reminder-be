import { ExecutionContext, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';

// Mock AuthGuard to allow per-test control of canActivate
let superCanActivate: jest.Mock;
jest.mock('@nestjs/passport', () => {
    return {
        AuthGuard: () => {
            return class MockAuthGuard {
                canActivate(...args: any[]) {
                    return superCanActivate(...args);
                }
            };
        },
    };
});

// Create a mock class that implements the necessary parts of JwtService
class MockJwtService {
    decode = jest.fn().mockReturnValue({ sub: 'test-user-id' });
    sign = jest.fn();
    signAsync = jest.fn();
    verify = jest.fn();
    verifyAsync = jest.fn();
}

describe('JwtAuthGuard', () => {
    beforeEach(() => {
        // Default: throw UnauthorizedException (matches original behavior)
        superCanActivate = jest.fn(() => {
            throw new UnauthorizedException();
        });
    });

    describe('handleRequest', () => {
        let loggerWarnSpy: jest.SpyInstance;
        beforeEach(() => {
            loggerWarnSpy = jest.spyOn(guard['logger'], 'warn').mockImplementation(() => {});
        });
        afterEach(() => {
            loggerWarnSpy.mockRestore();
        });

        it('should throw UnauthorizedException if err is present', () => {
            expect(() => guard.handleRequest(new Error('fail'), null, null)).toThrow(
                UnauthorizedException,
            );
        });

        it('should throw UnauthorizedException if user is missing', () => {
            expect(() => guard.handleRequest(null, null, { message: 'no user' })).toThrow(
                UnauthorizedException,
            );
        });

        it('should return user if present and no error', () => {
            const user = { id: 'test' };
            expect(guard.handleRequest(null, user, null)).toBe(user);
        });
    });

    describe('extractToken edge cases', () => {
        it('should return null if no token in any source', () => {
            const req = { headers: {}, cookies: {}, query: {} };
            // @ts-ignore
            expect(guard['extractToken'](req)).toBeNull();
        });
        it('should extract token from raw authorization header', () => {
            const req = { headers: { authorization: 'raw-token' }, cookies: {}, query: {} };
            // @ts-ignore
            expect(guard['extractToken'](req)).toBe('raw-token');
        });
    });
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
    let guard: JwtAuthGuard;
    let mockContext: ExecutionContext;
    let mockRequest: any;
    let mockHttpContext: any;
    let mockJwtService: MockJwtService;

    beforeEach(() => {
        // Use our mock class instead of trying to implement the full interface
        mockJwtService = new MockJwtService();

        guard = new JwtAuthGuard(mockJwtService as unknown as JwtService);

        mockRequest = {
            headers: {
                authorization: 'Bearer test-token',
            },
            body: {},
            path: '/test-path',
            method: 'GET',
            cookies: {},
            query: {},
        };

        mockHttpContext = {
            getRequest: jest.fn().mockReturnValue(mockRequest),
        };

        mockContext = {
            switchToHttp: jest.fn().mockReturnValue(mockHttpContext),
            getClass: jest.fn(),
            getHandler: jest.fn(),
            getArgs: jest.fn(),
            getArgByIndex: jest.fn(),
            switchToRpc: jest.fn(),
            switchToWs: jest.fn(),
            getType: jest.fn(() => 'http'),
        } as any;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(guard).toBeDefined();
    });

    // getRequest is not implemented in JwtAuthGuard, so this test is removed

    describe('canActivate', () => {
        it('should call super.canActivate with HTTP request', () => {
            // Simulate successful super.canActivate
            superCanActivate.mockReturnValueOnce(true);
            expect(guard.canActivate(mockContext)).toBe(true);
            expect(mockJwtService.decode).toHaveBeenCalledWith('test-token');
        });

        it('should throw when no token is present', async () => {
            mockRequest.headers.authorization = undefined;
            try {
                await guard.canActivate(mockContext);
                fail('Expected UnauthorizedException');
            } catch (e) {
                expect(e).toBeInstanceOf(UnauthorizedException);
                expect(e.message).toBe('Authentication token is missing');
            }
        });

        it('should handle invalid token format', async () => {
            mockJwtService.decode.mockImplementation(() => {
                throw new Error('Invalid token');
            });
            try {
                await guard.canActivate(mockContext);
                fail('Expected UnauthorizedException');
            } catch (e) {
                expect(e).toBeInstanceOf(UnauthorizedException);
                expect(e.message).toBe('Invalid authentication token format');
            }
        });

        it('should extract token from Authorization header without Bearer prefix', () => {
            superCanActivate.mockReturnValueOnce(true);
            mockRequest.headers.authorization = 'test-token-without-bearer';
            expect(guard.canActivate(mockContext)).toBe(true);
            expect(mockJwtService.decode).toHaveBeenCalledWith('test-token-without-bearer');
        });

        it('should extract token from cookies', () => {
            superCanActivate.mockReturnValueOnce(true);
            mockRequest.headers.authorization = undefined;
            mockRequest.cookies.access_token = 'cookie-token';
            expect(guard.canActivate(mockContext)).toBe(true);
            expect(mockJwtService.decode).toHaveBeenCalledWith('cookie-token');
        });

        it('should extract token from query parameters', () => {
            superCanActivate.mockReturnValueOnce(true);
            mockRequest.headers.authorization = undefined;
            mockRequest.query.access_token = 'query-token';
            expect(guard.canActivate(mockContext)).toBe(true);
            expect(mockJwtService.decode).toHaveBeenCalledWith('query-token');
        });
    });
});
