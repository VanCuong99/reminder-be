import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { ConfigService } from '@nestjs/config';
import { DeviceTokenService } from 'src/application/services/device-token/device-token.service';

const mockSend = jest.fn();

jest.mock('firebase-admin', () => {
    const messagingMock = {
        send: jest.fn().mockResolvedValue('mock-message-id-123'), // mock gửi thành công
        sendEachForMulticast: jest.fn().mockResolvedValue({
            responses: [{ success: true, messageId: ['mock-message-id-123'] }],
            successCount: 1,
            failureCount: 0,
        }),
    };

    const firebaseAppMock = {
        messaging: () => messagingMock,
    };

    return {
        __esModule: true,
        initializeApp: jest.fn(() => firebaseAppMock),
        credential: {
            cert: jest.fn().mockReturnValue({
                projectId: 'mock-project-id',
                private_key: 'mock-private-key',
                client_email: 'mock-client-email',
            }),
        },
        messaging: messagingMock, // Mock trả về messagingMock
    };
});

describe('NotificationService', () => {
    let notificationService: NotificationService;
    let mockDeviceTokenService: Partial<DeviceTokenService>;
    let configService: ConfigService;

    beforeEach(async () => {
        mockDeviceTokenService = {
            deactivateToken: jest.fn(),
            getUserActiveTokens: jest.fn().mockImplementation(() => Promise.resolve([])),
            getAllActiveTokens: jest.fn().mockImplementation(() => Promise.resolve([])),
        };

        const mockConfigService = {
            get: jest.fn().mockImplementation((key: string) => {
                if (key === 'FIREBASE_PRIVATE_KEY') {
                    return 'mock-private-key';
                }
                if (key === 'NODE_ENV') {
                    return 'test';
                }
                return null;
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                NotificationService,
                {
                    provide: DeviceTokenService,
                    useValue: mockDeviceTokenService,
                },
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();

        notificationService = module.get<NotificationService>(NotificationService);
        configService = module.get<ConfigService>(ConfigService);
        await notificationService.onModuleInit();
    });

    it('should initialize Firebase app successfully', async () => {
        const mockInitializeApp = require('firebase-admin').initializeApp;
        await notificationService.onModuleInit();
        expect(mockInitializeApp).toHaveBeenCalled();
    });

    it('should throw an error if private key is not configured', async () => {
        jest.spyOn(configService, 'get').mockReturnValue(null);
        await expect(notificationService.onModuleInit()).rejects.toThrow(
            'Firebase private key is not configured',
        );
    });

    describe('validateTokenFormat', () => {
        it('should validate test token format correctly', () => {
            const result = (notificationService as any).validateTokenFormat('test_token123');
            expect(result).toBe(true);
        });

        it('should validate production token format correctly', () => {
            jest.spyOn(configService, 'get').mockReturnValue('production');
            const validToken = 'f'.repeat(140); // Valid length token
            const result = (notificationService as any).validateTokenFormat(validToken);
            expect(result).toBe(true);
        });

        it('should reject invalid token format', () => {
            jest.spyOn(configService, 'get').mockReturnValue('production');
            const result = (notificationService as any).validateTokenFormat('invalid-token');
            expect(result).toBe(false);
        });
    });

    describe('sendNotification', () => {
        it('should handle invalid token format', async () => {
            const result = await notificationService.sendNotification('invalid-token', {
                title: 'Test',
                body: 'Test',
            });
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid FCM token format');
        });

        it('should handle test mode notification', async () => {
            const result = await notificationService.sendNotification('test_token123', {
                title: 'Test',
                body: 'Test',
            });
            expect(result.success).toBe(true);
            expect(result.messageId).toContain('mock-message-id');
        });

        it('should handle firebase errors', async () => {
            // Mô phỏng lỗi từ firebase khi gọi send
            require('firebase-admin').messaging.send.mockRejectedValueOnce(
                new Error('Firebase error'),
            );

            const result = await notificationService.sendNotification('f'.repeat(140), {
                title: 'Test',
                body: 'Test',
            });

            expect(result.success).toBe(false); // Kỳ vọng trả về false khi có lỗi
            expect(result.error).toBe('Firebase error'); // Kỳ vọng thông báo lỗi chính xác
        });
    });

    describe('sendNotificationToUser', () => {
        it('should handle case with no active tokens', async () => {
            jest.spyOn(mockDeviceTokenService, 'getUserActiveTokens').mockResolvedValue([]);

            const result = await notificationService.sendNotificationToUser('user-1', {
                title: 'Test',
                body: 'Test',
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('No active device tokens found for user');
        });

        it('should handle case with invalid tokens', async () => {
            jest.spyOn(mockDeviceTokenService, 'getUserActiveTokens').mockResolvedValue([
                { token: 'invalid-token' } as any,
            ]);

            const result = await notificationService.sendNotificationToUser('user-1', {
                title: 'Test',
                body: 'Test',
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('No valid FCM tokens found for user');
        });

        it('should successfully send notification to valid tokens', async () => {
            jest.spyOn(mockDeviceTokenService, 'getUserActiveTokens').mockResolvedValue([
                { token: 'test_token123' } as any,
            ]);

            const result = await notificationService.sendNotificationToUser('user-1', {
                title: 'Test',
                body: 'Test',
            });

            expect(result.success).toBe(true);
        });
    });

    describe('broadcastNotification', () => {
        it('should handle case with no active tokens', async () => {
            jest.spyOn(mockDeviceTokenService, 'getAllActiveTokens').mockResolvedValue([]);

            const result = await notificationService.broadcastNotification({
                title: 'Test',
                body: 'Test',
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('No active device tokens found');
        });

        it('should handle case with invalid tokens', async () => {
            jest.spyOn(mockDeviceTokenService, 'getAllActiveTokens').mockResolvedValue([
                { token: 'invalid-token' } as any,
            ]);

            const result = await notificationService.broadcastNotification({
                title: 'Test',
                body: 'Test',
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('No valid FCM tokens found');
        });

        it('should successfully broadcast to valid tokens', async () => {
            jest.spyOn(mockDeviceTokenService, 'getAllActiveTokens').mockResolvedValue([
                { token: 'test_token123' } as any,
            ]);

            const result = await notificationService.broadcastNotification({
                title: 'Test',
                body: 'Test',
            });

            expect(result.success).toBe(true);
        });
    });

    describe('sendTopicNotification', () => {
        it('should successfully send topic notification', async () => {
            // Mô phỏng gửi thông báo topic thành công
            require('firebase-admin').messaging.send.mockResolvedValueOnce('mock-message-id-123');
            require('firebase-admin').messaging.sendEachForMulticast.mockResolvedValueOnce({
                responses: [{ success: true, messageId: ['mock-message-id-123'] }],
                successCount: 1,
                failureCount: 0,
            });

            const result = await notificationService.sendTopicNotification('test-topic', {
                title: 'Test',
                body: 'Test',
            });

            expect(result.success).toBe(true);
            expect(result.messageIds).toContain('mock-message-id-123'); // Kiểm tra đúng messageId
        });

        it('should handle errors in topic notification', async () => {
            // Mô phỏng lỗi từ firebase khi gửi thông báo qua topic
            require('firebase-admin').messaging.send.mockRejectedValueOnce(
                new Error('Topic error'),
            );

            const result = await notificationService.sendTopicNotification('test-topic', {
                title: 'Test',
                body: 'Test',
            });

            expect(result.success).toBe(false); // Kỳ vọng trả về false khi có lỗi
            expect(result.error).toBe('Topic error'); // Kỳ vọng thông báo lỗi chính xác
        });
    });

    describe('handleInvalidTokens', () => {
        it('should deactivate invalid tokens', async () => {
            const mockResponse = {
                responses: [
                    { error: { code: 'messaging/invalid-registration-token' } },
                    { error: { code: 'messaging/registration-token-not-registered' } },
                ],
            };
            const tokens = ['token1', 'token2'];

            await (notificationService as any).handleInvalidTokens(mockResponse, tokens);

            expect(mockDeviceTokenService.deactivateToken).toHaveBeenCalledTimes(2);
            expect(mockDeviceTokenService.deactivateToken).toHaveBeenCalledWith('token1');
            expect(mockDeviceTokenService.deactivateToken).toHaveBeenCalledWith('token2');
        });
    });
});
