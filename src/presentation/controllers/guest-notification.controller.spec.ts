import { Test, TestingModule } from '@nestjs/testing';
import { GuestNotificationController } from './guest-notification.controller';
import { NotificationService } from '../../infrastructure/messaging/notification.service';
import { Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { NotificationResult } from '../../infrastructure/messaging/notification-result.interface';

describe('GuestNotificationController', () => {
    let controller: GuestNotificationController;
    let notificationService: NotificationService;
    let deviceFingerprintingService: { generateFingerprint: jest.Mock; ensureDeviceId: jest.Mock };

    // Spy on Logger to prevent console output in tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    // Mock data
    const mockDeviceId = 'device-123';
    const mockNotificationId = 'notification-456';
    const mockNotificationResult: NotificationResult = {
        success: true,
        messageId: 'message-789',
    };
    const mockGuestNotifications = {
        notifications: [
            {
                id: mockNotificationId,
                title: 'Test Notification',
                body: 'This is a test notification',
                read: false,
                createdAt: new Date().toISOString(),
            },
        ],
        count: 1,
    };

    const mockFirestore = {
        doc: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({
                exists: true,
            }),
            collection: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnThis(),
                get: jest.fn().mockResolvedValue({
                    docs: [{ id: 'mock-notification' }],
                }),
            }),
        }),
        collection: jest.fn().mockReturnValue({
            doc: jest.fn().mockReturnValue({
                collection: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnThis(),
                    get: jest.fn().mockResolvedValue({
                        docs: [{ id: 'mock-notification' }],
                    }),
                }),
            }),
        }),
    };

    beforeEach(async () => {
        deviceFingerprintingService = {
            generateFingerprint: jest.fn().mockReturnValue('generated-device-id'),
            ensureDeviceId: jest.fn((deviceId, headers) => ({
                deviceId: deviceId ?? 'generated-device-id',
            })),
        };
        const module: TestingModule = await Test.createTestingModule({
            controllers: [GuestNotificationController],
            providers: [
                {
                    provide: NotificationService,
                    useValue: {
                        getGuestNotifications: jest.fn(),
                        markGuestNotificationAsRead: jest.fn(),
                        sendNotificationToDevice: jest.fn(),
                        firebaseService: {
                            getFirestore: jest.fn().mockReturnValue(mockFirestore),
                        },
                    },
                },
                {
                    provide: require('../../shared/services/device-fingerprinting.service')
                        .DeviceFingerprintingService,
                    useValue: deviceFingerprintingService,
                },
            ],
        }).compile();

        controller = module.get<GuestNotificationController>(GuestNotificationController);
        notificationService = module.get<NotificationService>(NotificationService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('getNotifications', () => {
        const headers = { 'user-agent': 'test-agent', 'x-forwarded-for': '1.2.3.4' };
        it('should return notifications for a guest device', async () => {
            jest.spyOn(notificationService, 'getGuestNotifications').mockResolvedValue(
                mockGuestNotifications,
            );

            const result = await controller.getNotifications(mockDeviceId, headers, 1, 20);

            expect(deviceFingerprintingService.ensureDeviceId).toHaveBeenCalledWith(
                mockDeviceId,
                headers,
            );
            expect(notificationService.getGuestNotifications).toHaveBeenCalledWith(mockDeviceId, {
                page: 1,
                limit: 20,
                status: undefined,
            });
            expect(result).toEqual(mockGuestNotifications);
        });

        it('should auto-generate device ID when missing', async () => {
            jest.spyOn(notificationService, 'getGuestNotifications').mockResolvedValue(
                mockGuestNotifications,
            );
            const result = await controller.getNotifications(undefined, headers, 1, 20);
            expect(deviceFingerprintingService.ensureDeviceId).toHaveBeenCalledWith(
                undefined,
                headers,
            );
            expect(notificationService.getGuestNotifications).toHaveBeenCalledWith(
                'generated-device-id',
                {
                    page: 1,
                    limit: 20,
                    status: undefined,
                },
            );
            expect(result).toEqual(mockGuestNotifications);
        });

        it('should use default pagination values when not provided', async () => {
            jest.spyOn(notificationService, 'getGuestNotifications').mockResolvedValue(
                mockGuestNotifications,
            );

            await controller.getNotifications(mockDeviceId, headers);

            expect(deviceFingerprintingService.ensureDeviceId).toHaveBeenCalledWith(
                mockDeviceId,
                headers,
            );
            expect(notificationService.getGuestNotifications).toHaveBeenCalledWith(mockDeviceId, {
                page: 1,
                limit: 20,
                status: undefined,
            });
        });

        it('should handle errors from notification service', async () => {
            jest.spyOn(notificationService, 'getGuestNotifications').mockRejectedValue(
                new Error('Database error'),
            );

            await expect(controller.getNotifications(mockDeviceId, headers)).rejects.toThrow(
                'Database error',
            );
        });
    });

    describe('markAsRead', () => {
        const headers = { 'user-agent': 'test-agent', 'x-forwarded-for': '1.2.3.4' };
        it('should mark a notification as read', async () => {
            jest.spyOn(notificationService, 'markGuestNotificationAsRead').mockResolvedValue({
                success: true,
                id: mockNotificationId,
            });

            const result = await controller.markAsRead(mockDeviceId, headers, mockNotificationId);

            expect(notificationService.markGuestNotificationAsRead).toHaveBeenCalledWith(
                mockDeviceId,
                mockNotificationId,
            );
            expect(result).toEqual({ success: true, id: mockNotificationId });
        });

        it('should auto-generate device ID when missing', async () => {
            jest.spyOn(notificationService, 'markGuestNotificationAsRead').mockResolvedValue({
                success: true,
                id: mockNotificationId,
            });
            const result = await controller.markAsRead(undefined, headers, mockNotificationId);
            expect(deviceFingerprintingService.generateFingerprint).toHaveBeenCalledWith(
                'test-agent',
                '1.2.3.4',
            );
            expect(notificationService.markGuestNotificationAsRead).toHaveBeenCalledWith(
                'generated-device-id',
                mockNotificationId,
            );
            expect(result).toEqual({ success: true, id: mockNotificationId });
        });

        it('should throw NotFoundException when notification is not found', async () => {
            jest.spyOn(notificationService, 'markGuestNotificationAsRead').mockResolvedValue(null);

            await expect(
                controller.markAsRead(mockDeviceId, headers, mockNotificationId),
            ).rejects.toThrow(NotFoundException);
        });

        it('should handle errors from notification service', async () => {
            jest.spyOn(notificationService, 'markGuestNotificationAsRead').mockRejectedValue(
                new Error('Database error'),
            );

            await expect(
                controller.markAsRead(mockDeviceId, headers, mockNotificationId),
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('sendTestNotification', () => {
        const headers = { 'user-agent': 'test-agent', 'x-forwarded-for': '1.2.3.4' };
        it('should send a test notification to a guest device', async () => {
            jest.spyOn(notificationService, 'sendNotificationToDevice').mockResolvedValue(
                mockNotificationResult,
            );

            const result = await controller.sendTestNotification(mockDeviceId, headers);

            expect(notificationService.sendNotificationToDevice).toHaveBeenCalledWith(
                mockDeviceId,
                'Test Notification',
                'This is a test notification for your guest account',
                expect.objectContaining({
                    type: 'test',
                    timestamp: expect.any(String),
                }),
            );
            expect(result).toEqual(mockNotificationResult);
        });

        it('should auto-generate device ID when missing', async () => {
            jest.spyOn(notificationService, 'sendNotificationToDevice').mockResolvedValue(
                mockNotificationResult,
            );
            const result = await controller.sendTestNotification(undefined, headers);
            expect(deviceFingerprintingService.generateFingerprint).toHaveBeenCalledWith(
                'test-agent',
                '1.2.3.4',
            );
            expect(notificationService.sendNotificationToDevice).toHaveBeenCalledWith(
                'generated-device-id',
                'Test Notification',
                'This is a test notification for your guest account',
                expect.objectContaining({
                    type: 'test',
                    timestamp: expect.any(String),
                }),
            );
            expect(result).toEqual(mockNotificationResult);
        });

        it('should handle errors from notification service', async () => {
            const error = new Error('Failed to send notification');
            jest.spyOn(notificationService, 'sendNotificationToDevice').mockRejectedValue(error);

            const result = await controller.sendTestNotification(mockDeviceId, headers);

            expect(result).toEqual({
                success: false,
                error: error.message,
            });
        });
    });

    describe('getNotificationStatus', () => {
        const headers = { 'user-agent': 'test-agent', 'x-forwarded-for': '1.2.3.4' };
        it('should return notification status for a guest device', async () => {
            const result = await controller.getNotificationStatus(mockDeviceId, headers);

            expect(result).toEqual({
                success: true,
                deviceExists: true,
                devicePath: `guest_devices/${mockDeviceId}`,
                notificationsPath: `guest_devices/${mockDeviceId}/notifications`,
                collectionExists: true,
                sampleNotificationCount: 1,
                timestamp: expect.any(String),
            });
        });

        it('should auto-generate device ID when missing', async () => {
            const result = await controller.getNotificationStatus(undefined, headers);
            expect(deviceFingerprintingService.generateFingerprint).toHaveBeenCalledWith(
                'test-agent',
                '1.2.3.4',
            );
            expect(result).toEqual({
                success: true,
                deviceExists: true,
                devicePath: `guest_devices/generated-device-id`,
                notificationsPath: `guest_devices/generated-device-id/notifications`,
                collectionExists: true,
                sampleNotificationCount: 1,
                timestamp: expect.any(String),
            });
        });

        it('should return error response when Firebase is not initialized', async () => {
            // Mock the case where Firebase is not properly initialized
            jest.spyOn(notificationService['firebaseService'], 'getFirestore').mockReturnValueOnce(
                null,
            );

            const result = await controller.getNotificationStatus(mockDeviceId, headers);

            expect(result).toEqual({
                success: false,
                error: 'Firebase not properly initialized',
                timestamp: expect.any(String),
            });
        });

        it('should handle Firestore errors', async () => {
            // Mock Firestore throwing an error
            jest.spyOn(
                notificationService['firebaseService'],
                'getFirestore',
            ).mockImplementationOnce(() => {
                throw new Error('Firestore connection error');
            });

            const result = await controller.getNotificationStatus(mockDeviceId, headers);

            expect(result).toEqual({
                success: false,
                error: 'Firestore connection error',
                timestamp: expect.any(String),
            });
        });
    });
});
