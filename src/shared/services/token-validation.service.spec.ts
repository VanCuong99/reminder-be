import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '../../shared/constants/user-role.enum';
import { TokenValidationService } from './token-validation.service';
import { BadRequestException, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../application/services/auth/auth.service';
import { AuthProvider, AUTH_CONSTANTS } from '../../shared/constants/auth.constants';
import { CookieService } from '../../infrastructure/auth/services/cookie.service';

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

describe('private helpers', () => {
    let service: TokenValidationService;
    beforeAll(async () => {
        const mockAuthService = { decodeToken: jest.fn() };
        const mockConfigService = { get: jest.fn() };
        const mockCookieService = { setAuthCookies: jest.fn(), clearAuthCookies: jest.fn() };
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TokenValidationService,
                { provide: AuthService, useValue: mockAuthService },
                { provide: ConfigService, useValue: mockConfigService },
                { provide: CookieService, useValue: mockCookieService },
            ],
        }).compile();
        service = module.get<TokenValidationService>(TokenValidationService);
    });

    describe('extractTokenFromAuthHeader (error handling)', () => {
        it('should return null and log error if exception thrown', () => {
            // Simulate error by passing an object with a throwing toString
            const badInput = {
                toString: () => {
                    throw new Error('fail');
                },
            };
            // @ts-ignore
            expect(service.extractTokenFromAuthHeader(badInput)).toBeNull();
        });
    });

    describe('transformUserResponse', () => {
        it('should transform user to UserResponse shape', () => {
            // @ts-ignore
            const user = { id: '1', email: 'a', username: 'b', role: UserRole.USER };
            // @ts-ignore
            expect(service['transformUserResponse'](user)).toEqual(user);
        });
    });

    describe('getSuccessMessage', () => {
        it('should return correct message for registration', () => {
            // @ts-ignore            expect(service['getSuccessMessage'](AuthProvider.REGISTRATION)).toBe(AUTH_CONSTANTS.MESSAGES[AuthProvider.REGISTRATION]);
        });
        it('should return correct message for Google', () => {
            // @ts-ignore
            expect(service['getSuccessMessage'](AuthProvider.GOOGLE)).toBe(
                AUTH_CONSTANTS.MESSAGES[AuthProvider.GOOGLE],
            );
        });
        it('should return correct message for Facebook', () => {
            // @ts-ignore
            expect(service['getSuccessMessage'](AuthProvider.FACEBOOK)).toBe(
                AUTH_CONSTANTS.MESSAGES[AuthProvider.FACEBOOK],
            );
        });
        it('should return correct message for TokenRefresh', () => {
            // @ts-ignore
            expect(service['getSuccessMessage'](AuthProvider.TOKEN_REFRESH)).toBe(
                AUTH_CONSTANTS.MESSAGES[AuthProvider.TOKEN_REFRESH],
            );
        });
        it('should return default message for unknown provider', () => {
            // @ts-ignore
            expect(service['getSuccessMessage']('other')).toBe(
                AUTH_CONSTANTS.MESSAGES[AuthProvider.LOCAL],
            );
            // @ts-ignore
            expect(service['getSuccessMessage']()).toBe(
                AUTH_CONSTANTS.MESSAGES[AuthProvider.LOCAL],
            );
        });
    });
});

describe('TokenValidationService', () => {
    let service: TokenValidationService;
    let authService: AuthService;
    let configService: ConfigService;

    beforeEach(async () => {
        const mockAuthService = {
            decodeToken: jest.fn(),
        };
        const mockConfigService = {
            get: jest.fn(),
        };
        const mockCookieService = {
            setAuthCookies: jest.fn(),
            clearAuthCookies: jest.fn(),
        };
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TokenValidationService,
                { provide: AuthService, useValue: mockAuthService },
                { provide: ConfigService, useValue: mockConfigService },
                { provide: CookieService, useValue: mockCookieService },
            ],
        }).compile();

        service = module.get<TokenValidationService>(TokenValidationService);
        authService = module.get<AuthService>(AuthService);
        configService = module.get<ConfigService>(ConfigService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('validateFirebaseToken', () => {
        it('should throw BadRequestException if token is missing', () => {
            expect(() => {
                service.validateFirebaseToken(null);
            }).toThrow(BadRequestException);
            expect(() => {
                service.validateFirebaseToken('');
            }).toThrow('Firebase token is required');
        });

        it('should throw BadRequestException if token is too short', () => {
            expect(() => {
                service.validateFirebaseToken('shortToken123');
            }).toThrow('Invalid Firebase token format');
        });

        it('should throw BadRequestException if token contains invalid characters', () => {
            const invalidToken = 'A'.repeat(101) + '!@#$%^&*()';
            expect(() => {
                service.validateFirebaseToken(invalidToken);
            }).toThrow('Invalid Firebase token format');
        });

        it('should not throw for valid token format', () => {
            const validToken = 'A'.repeat(50) + 'B'.repeat(50) + 'C' + '-' + '_';
            expect(() => {
                service.validateFirebaseToken(validToken);
            }).not.toThrow();
        });
    });

    describe('extractTokenFromAuthHeader', () => {
        it('should extract token from Bearer authorization header', () => {
            const token = 'abc123token';
            const authHeader = `Bearer ${token}`;
            expect(service.extractTokenFromAuthHeader(authHeader)).toEqual(token);
        });

        it('should return authorization header if no Bearer prefix', () => {
            const token = 'abc123token';
            expect(service.extractTokenFromAuthHeader(token)).toEqual(token);
        });

        it('should return null if authorization header is undefined or empty', () => {
            expect(service.extractTokenFromAuthHeader(undefined)).toBeNull();
            expect(service.extractTokenFromAuthHeader('')).toBeNull();
        });
    });

    describe('extractTokenFromRequest', () => {
        it('should extract token from request object authorization header', () => {
            const token = 'abc123token';
            const request = {
                headers: {
                    authorization: `Bearer ${token}`,
                },
            };
            expect(service.extractTokenFromRequest(request)).toEqual(token);
        });

        describe('extractAccessToken', () => {
            it('should extract access token from cookies', () => {
                const req: any = {
                    cookies: { access_token: 'cookieToken' },
                    headers: { authorization: 'Bearer headerToken' },
                };
                expect(service.extractAccessToken(req)).toBe('cookieToken');
            });
            it('should extract access token from authorization header if not in cookies', () => {
                const req: any = { cookies: {}, headers: { authorization: 'Bearer headerToken' } };
                expect(service.extractAccessToken(req)).toBe('headerToken');
            });
            it('should return null if no access token found', () => {
                const req: any = { cookies: {}, headers: {} };
                expect(service.extractAccessToken(req)).toBeNull();
            });
        });

        describe('extractRefreshToken', () => {
            it('should extract refresh token from cookies', () => {
                const req: any = { cookies: { refresh_token: 'cookieRefresh' } };
                expect(service.extractRefreshToken(req)).toBe('cookieRefresh');
            });
            it('should extract refresh token from body if not in cookies', () => {
                const req: any = { cookies: {} };
                expect(service.extractRefreshToken(req, { refreshToken: 'bodyRefresh' })).toBe(
                    'bodyRefresh',
                );
            });
            it('should return null if no refresh token found', () => {
                const req: any = { cookies: {} };
                expect(service.extractRefreshToken(req)).toBeNull();
            });
        });

        describe('validateAndDecodeToken', () => {
            it('should return userId and tokenId if valid token', () => {
                (authService.decodeToken as jest.Mock).mockReturnValue({
                    sub: 'user1',
                    jti: 'token1',
                });
                expect(service.validateAndDecodeToken('sometoken')).toEqual({
                    userId: 'user1',
                    tokenId: 'token1',
                });
            });
            it('should return null if token missing sub or jti', () => {
                (authService.decodeToken as jest.Mock).mockReturnValue({});
                expect(service.validateAndDecodeToken('badtoken')).toBeNull();
            });
            it('should return null and log error if decode throws', () => {
                (authService.decodeToken as jest.Mock).mockImplementation(() => {
                    throw new Error('fail');
                });
                expect(service.validateAndDecodeToken('badtoken')).toBeNull();
            });
        });

        describe('setAuthCookies and clearAuthCookies', () => {
            let res: any;
            beforeEach(() => {
                res = { cookie: jest.fn() };
            });
            it('should set access and refresh cookies with correct options (production)', () => {
                service.setAuthCookies(res, 'at', 'rt', true);
                expect(res.cookie).toHaveBeenCalledWith(
                    'access_token',
                    'at',
                    expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'strict' }),
                );
                expect(res.cookie).toHaveBeenCalledWith(
                    'refresh_token',
                    'rt',
                    expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'strict' }),
                );
            });
            it('should set access and refresh cookies with correct options (not production)', () => {
                service.setAuthCookies(res, 'at', 'rt', false);
                expect(res.cookie).toHaveBeenCalledWith(
                    'access_token',
                    'at',
                    expect.objectContaining({ httpOnly: true, secure: false, sameSite: 'lax' }),
                );
                expect(res.cookie).toHaveBeenCalledWith(
                    'refresh_token',
                    'rt',
                    expect.objectContaining({ httpOnly: true, secure: false, sameSite: 'lax' }),
                );
            });
            it('should clear cookies by setting expires to epoch', () => {
                service.clearAuthCookies(res);
                expect(res.cookie).toHaveBeenCalledWith(
                    'access_token',
                    '',
                    expect.objectContaining({ expires: expect.any(Date) }),
                );
                expect(res.cookie).toHaveBeenCalledWith(
                    'refresh_token',
                    '',
                    expect.objectContaining({ expires: expect.any(Date) }),
                );
            });
        });

        describe('handleAuthResponse', () => {
            let res: any;
            beforeEach(() => {
                res = { cookie: jest.fn() };
                (configService.get as jest.Mock).mockReturnValue('production');
            });
            it('should return registration response with all user fields', () => {
                const authResponse = {
                    user: { id: '1', email: 'a', username: 'b', role: UserRole.USER, extra: 'x' },
                    tokens: { accessToken: 'at', refreshToken: 'rt', csrfToken: 'ct' },
                };
                const result = service.handleAuthResponse(
                    res,
                    authResponse,
                    AuthProvider.REGISTRATION,
                );
                expect(result).toMatchObject({
                    user: authResponse.user,
                    accessToken: 'at',
                    refreshToken: 'rt',
                    csrfToken: 'ct',
                    message: AUTH_CONSTANTS.MESSAGES[AuthProvider.REGISTRATION],
                });
            });
            it('should return refresh response with all user fields', () => {
                const authResponse = {
                    user: { id: '1', email: 'a', username: 'b', role: UserRole.USER, extra: 'x' },
                    tokens: { accessToken: 'at', refreshToken: 'rt', csrfToken: 'ct' },
                };
                const result = service.handleAuthResponse(
                    res,
                    authResponse,
                    AuthProvider.TOKEN_REFRESH,
                );
                expect(result).toMatchObject({
                    user: authResponse.user,
                    accessToken: 'at',
                    refreshToken: 'rt',
                    csrfToken: 'ct',
                    message: AUTH_CONSTANTS.MESSAGES[AuthProvider.TOKEN_REFRESH],
                });
            });
            it('should return login response with selected user fields', () => {
                const authResponse = {
                    user: {
                        id: '1',
                        email: 'a',
                        username: 'b',
                        role: UserRole.USER,
                        createdAt: 'now',
                        updatedAt: 'now',
                        isActive: true,
                        extra: 'x',
                    },
                    tokens: { accessToken: 'at', refreshToken: 'rt', csrfToken: 'ct' },
                };
                const result = service.handleAuthResponse(res, authResponse);
                expect(result.user).toMatchObject({
                    id: '1',
                    email: 'a',
                    username: 'b',
                    role: UserRole.USER,
                    createdAt: 'now',
                    updatedAt: 'now',
                    isActive: true,
                });
                expect(result).toMatchObject({
                    accessToken: 'at',
                    refreshToken: 'rt',
                    csrfToken: 'ct',
                    message: AUTH_CONSTANTS.MESSAGES[AuthProvider.LOCAL],
                });
            });
            it('should return Google login message', () => {
                const authResponse = {
                    user: { id: '1', email: 'a', username: 'b', role: UserRole.USER },
                    tokens: { accessToken: 'at', refreshToken: 'rt', csrfToken: 'ct' },
                };
                const result = service.handleAuthResponse(res, authResponse, AuthProvider.GOOGLE);
                expect(result.message).toBe(AUTH_CONSTANTS.MESSAGES[AuthProvider.GOOGLE]);
            });
            it('should return Facebook login message', () => {
                const authResponse = {
                    user: { id: '1', email: 'a', username: 'b', role: UserRole.USER },
                    tokens: { accessToken: 'at', refreshToken: 'rt', csrfToken: 'ct' },
                };
                const result = service.handleAuthResponse(res, authResponse, AuthProvider.FACEBOOK);
                expect(result.message).toBe(AUTH_CONSTANTS.MESSAGES[AuthProvider.FACEBOOK]);
            });
        });

        describe('transformProfileResponse', () => {
            it('should return success false if user is null', () => {
                expect(service.transformProfileResponse(null)).toEqual({
                    success: false,
                    user: null,
                    isAuthenticated: false,
                });
            });
            it('should return user profile response if user exists', () => {
                const user = {
                    id: '1',
                    email: 'a',
                    username: 'b',
                    role: 'user',
                    isActive: true,
                    createdAt: 'now',
                    updatedAt: 'now',
                };
                expect(service.transformProfileResponse(user)).toEqual({
                    success: true,
                    user: { ...user },
                    isAuthenticated: true,
                });
            });
        });

        describe('validateAndTransformSocialUser', () => {
            it('should throw UnauthorizedException if missing fields', () => {
                expect(() => service.validateAndTransformSocialUser({})).toThrow(
                    UnauthorizedException,
                );
            });
            it('should return transformed social user if valid', () => {
                const user = { socialId: 'sid', email: 'e', name: 'n', provider: 'p', avatar: 'a' };
                expect(service.validateAndTransformSocialUser(user)).toEqual(user);
            });
        });

        it('should return null if request has no authorization header', () => {
            const request = { headers: {} };
            expect(service.extractTokenFromRequest(request)).toBeNull();
        });
    });
});
