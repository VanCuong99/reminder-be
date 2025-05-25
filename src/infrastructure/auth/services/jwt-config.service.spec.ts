import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { JwtConfigService } from './jwt-config.service';

describe('JwtConfigService', () => {
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
    let service: JwtConfigService;
    let configService: ConfigService;

    // Suppress logger output in tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});

    // Sample valid RS256 JWT token for testing (the signature is not valid but format is correct)
    const sampleRS256Token =
        'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.signature';
    // Sample valid HS256 JWT token for testing (the signature is not valid but format is correct)
    const sampleHS256Token =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.signature';
    // Sample invalid format JWT token
    const invalidToken = 'invalid-token';

    // Mock JWT to avoid actual crypto operations
    const mockJwt = {
        decode: jest.fn(),
        verify: jest.fn(),
    };

    // Setup mock for jsonwebtoken module
    jest.mock('jsonwebtoken', () => mockJwt);

    beforeEach(() => {
        // Reset mocks for each test
        jest.clearAllMocks();
    });

    describe('RS256 Configuration', () => {
        beforeEach(async () => {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    JwtConfigService,
                    {
                        provide: ConfigService,
                        useValue: {
                            get: jest.fn((key: string) => {
                                const config = {
                                    JWT_ALGORITHM: 'RS256',
                                    JWT_PUBLIC_KEY: 'mock-public-key',
                                    JWT_PRIVATE_KEY: 'mock-private-key',
                                    JWT_EXPIRATION: '2h',
                                    JWT_REFRESH_EXPIRATION: '14d',
                                };
                                return config[key];
                            }),
                        },
                    },
                ],
            }).compile();

            service = module.get<JwtConfigService>(JwtConfigService);
        });

        it('should be defined', () => {
            expect(service).toBeDefined();
        });

        it('should initialize with RS256 algorithm when public and private keys are provided', () => {
            expect(service.algorithm).toBe('RS256');
        });

        it('should return private key for secretOrPrivateKey getter', () => {
            expect(service.secretOrPrivateKey).toBe('mock-private-key');
        });

        it('should return public key for secretOrPublicKey getter', () => {
            expect(service.secretOrPublicKey).toBe('mock-public-key');
        });

        it('should return correct token expirations', () => {
            expect(service.accessTokenExpiration).toBe('2h');
            expect(service.refreshTokenExpiration).toBe('14d');
        });

        it('should return correctly configured jwtModuleOptions for RS256', () => {
            const options = service.jwtModuleOptions;
            expect(options).toEqual({
                privateKey: 'mock-private-key',
                publicKey: 'mock-public-key',
                signOptions: {
                    algorithm: 'RS256',
                    expiresIn: '2h',
                },
                verifyOptions: {
                    algorithms: ['RS256'],
                },
            });
        });
    });

    describe('HS256 Configuration', () => {
        beforeEach(async () => {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    JwtConfigService,
                    {
                        provide: ConfigService,
                        useValue: {
                            get: jest.fn((key: string) => {
                                const config = {
                                    JWT_ALGORITHM: 'HS256',
                                    JWT_SECRET: 'mock-secret-key',
                                    JWT_EXPIRATION: '1h',
                                    JWT_REFRESH_EXPIRATION: '7d',
                                };
                                return config[key];
                            }),
                        },
                    },
                ],
            }).compile();

            service = module.get<JwtConfigService>(JwtConfigService);
        });

        it('should be defined', () => {
            expect(service).toBeDefined();
        });

        it('should initialize with HS256 algorithm when secret is provided', () => {
            expect(service.algorithm).toBe('HS256');
        });

        it('should return secret key for both secretOrPrivateKey and secretOrPublicKey getters', () => {
            expect(service.secretOrPrivateKey).toBe('mock-secret-key');
            expect(service.secretOrPublicKey).toBe('mock-secret-key');
        });

        it('should return correct token expirations', () => {
            expect(service.accessTokenExpiration).toBe('1h');
            expect(service.refreshTokenExpiration).toBe('7d');
        });

        it('should return correctly configured jwtModuleOptions for HS256', () => {
            const options = service.jwtModuleOptions;
            expect(options).toEqual({
                secret: 'mock-secret-key',
                signOptions: {
                    algorithm: 'HS256',
                    expiresIn: '1h',
                },
                verifyOptions: {
                    algorithms: ['HS256'],
                },
            });
        });
    });

    describe('Fallback Configuration', () => {
        beforeEach(async () => {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    JwtConfigService,
                    {
                        provide: ConfigService,
                        useValue: {
                            get: jest.fn((key: string) => {
                                // Return undefined for all JWT config values to test fallback
                                return undefined;
                            }),
                        },
                    },
                ],
            }).compile();

            service = module.get<JwtConfigService>(JwtConfigService);
        });

        it('should use fallback defaults when no JWT configuration is provided', () => {
            expect(service.algorithm).toBe('HS256');
            expect(service.secretOrPrivateKey).toBe('development_secret_do_not_use_in_production');
            expect(service.secretOrPublicKey).toBe('development_secret_do_not_use_in_production');
            expect(service.accessTokenExpiration).toBe('1h');
            expect(service.refreshTokenExpiration).toBe('7d');
        });
    });

    describe('inspectToken method', () => {
        beforeEach(async () => {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    JwtConfigService,
                    {
                        provide: ConfigService,
                        useValue: {
                            get: jest.fn((key: string) => {
                                const config = {
                                    JWT_ALGORITHM: 'RS256',
                                    JWT_PUBLIC_KEY: 'mock-public-key',
                                    JWT_PRIVATE_KEY: 'mock-private-key',
                                };
                                return config[key];
                            }),
                        },
                    },
                ],
            }).compile();

            service = module.get<JwtConfigService>(JwtConfigService);
            // Setup mock for require('jsonwebtoken')
            const realRequire = jest.requireActual('jsonwebtoken');
            (service as any).require = jest.fn().mockReturnValue({
                decode: realRequire.decode,
                verify: jest.fn(),
            });
        });

        it('should correctly decode a valid RS256 token', () => {
            // Setup mock return value for jwt.decode
            jest.spyOn(require('jsonwebtoken'), 'decode').mockReturnValue({
                header: { alg: 'RS256', typ: 'JWT' },
                payload: { sub: '1234567890', name: 'John Doe', iat: 1516239022 },
            });

            const result = service.inspectToken(sampleRS256Token);

            expect(result).toEqual({
                parsed: { sub: '1234567890', name: 'John Doe', iat: 1516239022 },
                header: { alg: 'RS256', typ: 'JWT' },
                isRS256: true,
            });
        });

        it('should correctly decode a valid HS256 token', () => {
            // Setup mock return value for jwt.decode
            jest.spyOn(require('jsonwebtoken'), 'decode').mockReturnValue({
                header: { alg: 'HS256', typ: 'JWT' },
                payload: { sub: '1234567890', name: 'John Doe', iat: 1516239022 },
            });

            const result = service.inspectToken(sampleHS256Token);

            expect(result).toEqual({
                parsed: { sub: '1234567890', name: 'John Doe', iat: 1516239022 },
                header: { alg: 'HS256', typ: 'JWT' },
                isRS256: false,
            });
        });

        it('should handle decoding errors gracefully', () => {
            // Setup mock to throw an error on decode
            jest.spyOn(require('jsonwebtoken'), 'decode').mockImplementation(() => {
                throw new Error('Decoding error');
            });

            const result = service.inspectToken(invalidToken);

            expect(result).toEqual({
                parsed: null,
                header: null,
                isRS256: false,
            });
        });

        it('should handle null decode result', () => {
            // Setup mock to return null on decode
            jest.spyOn(require('jsonwebtoken'), 'decode').mockReturnValue(null);

            const result = service.inspectToken(invalidToken);

            expect(result).toEqual({
                parsed: null,
                header: null,
                isRS256: false,
            });
        });
    });

    describe('verifyToken method', () => {
        beforeEach(async () => {
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    JwtConfigService,
                    {
                        provide: ConfigService,
                        useValue: {
                            get: jest.fn((key: string) => {
                                const config = {
                                    JWT_ALGORITHM: 'RS256',
                                    JWT_PUBLIC_KEY: 'mock-public-key',
                                    JWT_PRIVATE_KEY: 'mock-private-key',
                                    JWT_SECRET: 'mock-secret',
                                };
                                return config[key];
                            }),
                        },
                    },
                ],
            }).compile();

            service = module.get<JwtConfigService>(JwtConfigService);

            // Mock the inspectToken method
            jest.spyOn(service, 'inspectToken');
        });

        it('should verify RS256 tokens with the public key', async () => {
            // Setup mock for inspectToken to indicate RS256
            (service.inspectToken as jest.Mock).mockReturnValue({
                parsed: { sub: '1234567890' },
                header: { alg: 'RS256' },
                isRS256: true,
            });

            // Setup mock for jwt.verify
            const mockPayload = { sub: '1234567890', name: 'John Doe' };
            jest.spyOn(require('jsonwebtoken'), 'verify').mockReturnValue(mockPayload);

            const result = await service.verifyToken(sampleRS256Token);

            expect(service.inspectToken).toHaveBeenCalledWith(sampleRS256Token);
            expect(require('jsonwebtoken').verify).toHaveBeenCalledWith(
                sampleRS256Token,
                'mock-public-key',
                { algorithms: ['RS256'] },
            );
            expect(result).toEqual(mockPayload);
        });

        it('should verify HS256 tokens with the secret', async () => {
            // Setup mock for inspectToken to indicate HS256
            (service.inspectToken as jest.Mock).mockReturnValue({
                parsed: { sub: '1234567890' },
                header: { alg: 'HS256' },
                isRS256: false,
            });

            // Setup mock for jwt.verify
            const mockPayload = { sub: '1234567890', name: 'John Doe' };
            jest.spyOn(require('jsonwebtoken'), 'verify').mockReturnValue(mockPayload);

            const result = await service.verifyToken(sampleHS256Token);

            expect(service.inspectToken).toHaveBeenCalledWith(sampleHS256Token);
            expect(require('jsonwebtoken').verify).toHaveBeenCalledWith(
                sampleHS256Token,
                'mock-secret',
                { algorithms: ['HS256'] },
            );
            expect(result).toEqual(mockPayload);
        });

        it('should throw an error when attempting to verify RS256 token without public key', async () => {
            // Setup a new instance with missing public key
            const moduleWithoutPublicKey: TestingModule = await Test.createTestingModule({
                providers: [
                    JwtConfigService,
                    {
                        provide: ConfigService,
                        useValue: {
                            get: jest.fn((key: string) => {
                                const config = {
                                    JWT_ALGORITHM: 'RS256',
                                    JWT_PRIVATE_KEY: 'mock-private-key',
                                    // Public key is missing
                                };
                                return config[key];
                            }),
                        },
                    },
                ],
            }).compile();

            const serviceWithoutPublicKey =
                moduleWithoutPublicKey.get<JwtConfigService>(JwtConfigService);

            // Setup mock for inspectToken to indicate RS256
            jest.spyOn(serviceWithoutPublicKey, 'inspectToken').mockReturnValue({
                parsed: { sub: '1234567890' },
                header: { alg: 'RS256' },
                isRS256: true,
            });

            await expect(serviceWithoutPublicKey.verifyToken(sampleRS256Token)).rejects.toThrow(
                'RS256 token requires a public key, but none is configured',
            );
        });

        it('should throw an error when attempting to verify HS256 token without secret', async () => {
            // Setup a new instance with missing secret
            const moduleWithoutSecret: TestingModule = await Test.createTestingModule({
                providers: [
                    JwtConfigService,
                    {
                        provide: ConfigService,
                        useValue: {
                            get: jest.fn((key: string) => {
                                const config = {
                                    JWT_ALGORITHM: 'HS256',
                                    // Secret is missing
                                };
                                return config[key];
                            }),
                        },
                    },
                ],
            }).compile();

            const serviceWithoutSecret =
                moduleWithoutSecret.get<JwtConfigService>(JwtConfigService);

            // Override the fallback secret to simulate error
            (serviceWithoutSecret as any)._secret = null;

            // Setup mock for inspectToken to indicate HS256
            jest.spyOn(serviceWithoutSecret, 'inspectToken').mockReturnValue({
                parsed: { sub: '1234567890' },
                header: { alg: 'HS256' },
                isRS256: false,
            });

            await expect(serviceWithoutSecret.verifyToken(sampleHS256Token)).rejects.toThrow(
                'HS256 token requires a secret, but none is configured',
            );
        });

        it('should propagate errors from jwt.verify', async () => {
            // Setup mock for inspectToken to indicate RS256
            (service.inspectToken as jest.Mock).mockReturnValue({
                parsed: { sub: '1234567890' },
                header: { alg: 'RS256' },
                isRS256: true,
            });

            // Setup mock for jwt.verify to throw an error
            const verifyError = new Error('Token expired');
            jest.spyOn(require('jsonwebtoken'), 'verify').mockImplementation(() => {
                throw verifyError;
            });

            await expect(service.verifyToken(sampleRS256Token)).rejects.toThrow(verifyError);
        });
    });
});
