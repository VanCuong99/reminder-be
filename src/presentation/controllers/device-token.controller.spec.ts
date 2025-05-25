import { Test, TestingModule } from '@nestjs/testing';
import { DeviceTokenController } from './device-token.controller';
import { DeviceTokenService } from '../../application/services/device-token/device-token.service';
import { RegisterDeviceTokenDto, DeviceType } from '../dto/device-token/register-device-token.dto';
import { User } from '../../domain/entities/user.entity';
import { NotFoundException, Logger } from '@nestjs/common';
import { UserRole } from '../../shared/constants/user-role.enum';
import { Request } from 'express';
import { TokenValidationService } from '../../shared/services/token-validation.service';

describe('DeviceTokenController', () => {
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
    let controller: DeviceTokenController;
    let deviceTokenService: jest.Mocked<DeviceTokenService>;

    const mockUser = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword',
        role: UserRole.USER,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deviceTokens: [],
    } as User;

    const mockToken = {
        id: '1',
        token: 'test_device_token_123',
        deviceType: DeviceType.IOS,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: '1',
        user: mockUser,
    };

    // Create a mock Express request with all required fields
    const mockRequest = {
        headers: {
            authorization: 'Bearer mock-jwt-token',
            'x-csrf-token': 'mock-csrf-token',
        },
        // Add minimal implementation of required methods
        header: jest.fn(),
        get: jest.fn(),
        accepts: jest.fn(),
        acceptsEncodings: jest.fn(),
        acceptsCharsets: jest.fn(),
        acceptsLanguages: jest.fn(),
        // Minimal implementation of other required properties
        body: {},
        params: {},
        query: {},
        cookies: {},
        signedCookies: {},
        // Add dummy methods required by Express.Request interface
        app: {},
        res: {},
        path: '',
        baseUrl: '',
        url: '',
        originalUrl: '',
        route: {},
        protocol: 'http',
        secure: false,
        ip: '127.0.0.1',
        ips: [],
        hostname: 'localhost',
        method: 'POST',
        fresh: false,
        stale: true,
        xhr: false,
        socket: {},
    } as unknown as Request;

    beforeEach(async () => {
        const mockDeviceTokenService = {
            saveToken: jest.fn(),
            deactivateToken: jest.fn(),
            getUserActiveTokens: jest.fn(),
        };
        const mockTokenValidationService = {
            extractTokenFromRequest: jest.fn(() => 'mock-token'),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [DeviceTokenController],
            providers: [
                {
                    provide: DeviceTokenService,
                    useValue: mockDeviceTokenService,
                },
                {
                    provide: require('@nestjs/jwt').JwtService,
                    useValue: {},
                },
                {
                    provide: TokenValidationService,
                    useValue: mockTokenValidationService,
                },
            ],
        }).compile();

        controller = module.get<DeviceTokenController>(DeviceTokenController);
        deviceTokenService = module.get(DeviceTokenService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('registerDeviceToken', () => {
        it('should register a device token successfully', async () => {
            // Arrange
            const registerDto: RegisterDeviceTokenDto = {
                token: 'test_device_token_123',
                deviceType: DeviceType.IOS,
            };

            deviceTokenService.saveToken.mockResolvedValue(mockToken);

            // Act
            const result = await controller.registerDeviceToken(registerDto, mockUser, mockRequest);

            // Assert
            expect(result).toBe(mockToken);
            expect(deviceTokenService.saveToken).toHaveBeenCalledWith(
                mockUser,
                registerDto.token,
                registerDto.deviceType,
            );
        });

        it('should propagate errors when token registration fails', async () => {
            // Arrange
            const registerDto: RegisterDeviceTokenDto = {
                token: 'invalid_token',
                deviceType: DeviceType.IOS,
            };

            const error = new Error('Invalid token format');
            deviceTokenService.saveToken.mockRejectedValue(error);

            // Act & Assert
            await expect(
                controller.registerDeviceToken(registerDto, mockUser, mockRequest),
            ).rejects.toThrow(error);
            expect(deviceTokenService.saveToken).toHaveBeenCalledWith(
                mockUser,
                registerDto.token,
                registerDto.deviceType,
            );
        });
    });

    describe('deactivateDeviceToken', () => {
        it('should deactivate a token successfully', async () => {
            // Arrange
            const token = 'test_device_token_123';
            deviceTokenService.deactivateToken.mockResolvedValue(undefined);

            // Act
            const result = await controller.deactivateDeviceToken(token, mockUser, mockRequest);

            // Assert
            expect(result).toEqual({ success: true });
            expect(deviceTokenService.deactivateToken).toHaveBeenCalledWith(token);
        });

        it('should propagate errors when token deactivation fails', async () => {
            // Arrange
            const token = 'nonexistent_token';
            const error = new NotFoundException('Token not found');
            deviceTokenService.deactivateToken.mockRejectedValue(error);

            // Act & Assert
            await expect(
                controller.deactivateDeviceToken(token, mockUser, mockRequest),
            ).rejects.toThrow(NotFoundException);
            expect(deviceTokenService.deactivateToken).toHaveBeenCalledWith(token);
        });
    });

    describe('myDeviceTokens', () => {
        it('should return active tokens for the current user', async () => {
            // Arrange
            const mockTokens = [mockToken];
            deviceTokenService.getUserActiveTokens.mockResolvedValue(mockTokens);

            // Act
            const result = await controller.myDeviceTokens(mockUser, mockRequest);

            // Assert
            expect(result).toBe(mockTokens);
            expect(deviceTokenService.getUserActiveTokens).toHaveBeenCalledWith(mockUser.id);
        });
    });

    describe('userDeviceTokens', () => {
        it('should return active tokens for a specific user', async () => {
            // Arrange
            const userId = '2';
            const mockTokens = [
                {
                    ...mockToken,
                    userId: '2',
                },
            ];
            deviceTokenService.getUserActiveTokens.mockResolvedValue(mockTokens);

            // Act
            const result = await controller.userDeviceTokens(userId, mockRequest);

            // Assert
            expect(result).toBe(mockTokens);
            expect(deviceTokenService.getUserActiveTokens).toHaveBeenCalledWith(userId);
        });

        it('should propagate errors when fetching tokens fails', async () => {
            // Arrange
            const userId = 'nonexistent';
            const error = new NotFoundException('User not found');
            deviceTokenService.getUserActiveTokens.mockRejectedValue(error);

            // Act & Assert
            await expect(controller.userDeviceTokens(userId, mockRequest)).rejects.toThrow(
                NotFoundException,
            );
            expect(deviceTokenService.getUserActiveTokens).toHaveBeenCalledWith(userId);
        });
    });

    describe('registerDeviceToken error handling', () => {
        it('should log and rethrow error from deviceTokenService.saveToken', async () => {
            const registerDto: RegisterDeviceTokenDto = {
                token: 'test_device_token_123',
                deviceType: DeviceType.IOS,
            };
            const error = new Error('saveToken failed');
            deviceTokenService.saveToken.mockRejectedValue(error);
            await expect(
                controller.registerDeviceToken(registerDto, mockUser, mockRequest),
            ).rejects.toThrow('saveToken failed');
            expect(loggerErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to register device token'),
                expect.anything(),
            );
        });
    });

    describe('extractTokenFromRequest (real service)', () => {
        let controller: DeviceTokenController;
        beforeEach(async () => {
            // Create a real instance with dummy dependencies
            const {
                TokenValidationService,
            } = require('../../shared/services/token-validation.service');
            const realTokenValidationService = new TokenValidationService({}, {});
            const module: TestingModule = await Test.createTestingModule({
                controllers: [DeviceTokenController],
                providers: [
                    {
                        provide: DeviceTokenService,
                        useValue: {
                            saveToken: jest.fn(),
                            deactivateToken: jest.fn(),
                            getUserActiveTokens: jest.fn(),
                        },
                    },
                    {
                        provide: require('@nestjs/jwt').JwtService,
                        useValue: {},
                    },
                    {
                        provide: TokenValidationService,
                        useValue: realTokenValidationService,
                    },
                ],
            }).compile();
            controller = module.get<DeviceTokenController>(DeviceTokenController);
        });

        it('should extract Bearer token from authorization header', () => {
            const req: any = { headers: { authorization: 'Bearer mytoken123' } };
            const token = (controller as any).extractTokenFromRequest(req);
            expect(token).toBe('mytoken123');
        });
        it('should return full authorization header if not Bearer', () => {
            const req: any = { headers: { authorization: 'Basic abcdef' } };
            const token = (controller as any).extractTokenFromRequest(req);
            expect(token).toBe('Basic abcdef');
        });
        it('should return null if no authorization header', () => {
            const req: any = { headers: {} };
            const token = (controller as any).extractTokenFromRequest(req);
            expect(token).toBeNull();
        });
        it('should log and return null if error thrown', () => {
            const req: any = null;
            const token = (controller as any).extractTokenFromRequest(req);
            expect(token).toBeNull();
            expect(loggerErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Error extracting token'),
            );
        });
    });

    describe('userDeviceTokens error/edge cases', () => {
        it('should return undefined if userId is missing', async () => {
            await expect(
                controller.userDeviceTokens(undefined as any, mockRequest),
            ).resolves.toBeUndefined();
        });
        it('should propagate error from deviceTokenService.getUserActiveTokens', async () => {
            const error = new Error('DB error');
            deviceTokenService.getUserActiveTokens.mockRejectedValue(error);
            await expect(controller.userDeviceTokens('badid', mockRequest)).rejects.toThrow(
                'DB error',
            );
        });
    });

    describe('registerDeviceToken edge cases', () => {
        it('should handle missing authorization header gracefully', async () => {
            const registerDto: RegisterDeviceTokenDto = {
                token: 'test_device_token_123',
                deviceType: DeviceType.IOS,
            };
            const reqNoAuth: any = { ...mockRequest, headers: { ...mockRequest.headers } };
            delete reqNoAuth.headers.authorization;
            deviceTokenService.saveToken.mockResolvedValue(mockToken);
            const result = await controller.registerDeviceToken(registerDto, mockUser, reqNoAuth);
            expect(result).toBe(mockToken);
            expect(deviceTokenService.saveToken).toHaveBeenCalledWith(
                mockUser,
                registerDto.token,
                registerDto.deviceType,
            );
        });

        it('should handle missing CSRF token header gracefully', async () => {
            const registerDto: RegisterDeviceTokenDto = {
                token: 'test_device_token_123',
                deviceType: DeviceType.IOS,
            };
            const reqNoCsrf: any = { ...mockRequest, headers: { ...mockRequest.headers } };
            delete reqNoCsrf.headers['x-csrf-token'];
            deviceTokenService.saveToken.mockResolvedValue(mockToken);
            const result = await controller.registerDeviceToken(registerDto, mockUser, reqNoCsrf);
            expect(result).toBe(mockToken);
        });

        it('should throw if user is missing', async () => {
            const registerDto: RegisterDeviceTokenDto = {
                token: 'test_device_token_123',
                deviceType: DeviceType.IOS,
            };
            await expect(
                controller.registerDeviceToken(registerDto, undefined as any, mockRequest),
            ).rejects.toThrow('User is required');
        });
    });

    describe('deactivateDeviceToken edge cases', () => {
        it('should throw if user is missing', async () => {
            const token = 'test_device_token_123';
            await expect(
                controller.deactivateDeviceToken(token, undefined as any, mockRequest),
            ).rejects.toThrow('User is required');
        });
    });

    describe('myDeviceTokens edge cases', () => {
        it('should throw if user is missing', async () => {
            await expect(controller.myDeviceTokens(undefined as any, mockRequest)).rejects.toThrow(
                'User is required',
            );
        });
    });

    describe('userDeviceTokens edge cases', () => {
        it('should return undefined if userId is missing', async () => {
            await expect(
                controller.userDeviceTokens(undefined as any, mockRequest),
            ).resolves.toBeUndefined();
        });
    });
});
