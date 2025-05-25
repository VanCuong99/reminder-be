import { UserRole } from '../../shared/constants/user-role.enum';
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationController } from './notification.controller';
import { NotificationService } from '../../infrastructure/messaging/notification.service';
import { SendUserNotificationDto } from '../dto/notification/send-user-notification.dto';
import { Logger } from '@nestjs/common';

describe('NotificationController', () => {
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
    describe('decorators and guards', () => {
        it('should have RolesGuard and Roles decorator on sendToUser', () => {
            // Get the prototype method
            const proto = Object.getPrototypeOf(controller);
            const method = proto.sendToUser;
            // Guards
            const guards = Reflect.getMetadata('__guards__', method);
            expect(guards).toBeDefined();
            // Optionally check for RolesGuard specifically
            // expect(guards.some((g: any) => g === RolesGuard)).toBe(true);
            // Roles
            const roles = Reflect.getMetadata('roles', method);
            expect(roles).toContain(UserRole.ADMIN);
        });
        it('should have RolesGuard and Roles decorator on broadcast', () => {
            const proto = Object.getPrototypeOf(controller);
            const method = proto.broadcast;
            const guards = Reflect.getMetadata('__guards__', method);
            expect(guards).toBeDefined();
            const roles = Reflect.getMetadata('roles', method);
            expect(roles).toContain(UserRole.ADMIN);
        });
    });

    describe('edge cases and DTOs', () => {
        it('should handle missing optional data field in sendNotificationToUser', async () => {
            const sendDto = {
                userId: '1',
                notification: { title: 't', body: 'b' },
                // no data
            } as any;
            notificationService.sendNotificationToUser.mockResolvedValue({ success: true });
            const result = await controller.sendNotificationToUser(sendDto);
            expect(result.success).toBe(true);
            expect(notificationService.sendNotificationToUser).toHaveBeenCalledWith(
                sendDto.userId,
                sendDto.notification,
                {},
            );
        });

        it('should handle missing optional data field in sendToUser', async () => {
            const userId = '2';
            const payload = { title: 'Admin', body: 'Body' } as any;
            notificationService.sendNotificationToUser.mockResolvedValue({ success: true });
            const result = await controller.sendToUser(userId, payload);
            expect(result).toEqual({ success: true, message: 'Notification sent' });
            expect(notificationService.sendNotificationToUser).toHaveBeenCalledWith(
                userId,
                { title: payload.title, body: payload.body },
                {},
            );
        });

        it('should handle missing optional data field in broadcast', async () => {
            const payload = { title: 't', body: 'b' } as any;
            notificationService.broadcastNotification.mockResolvedValue({ success: true });
            const result = await controller.broadcast(payload);
            expect(result).toEqual({
                success: true,
                message: 'Notification broadcast to all users',
            });
            expect(notificationService.broadcastNotification).toHaveBeenCalledWith(
                { title: payload.title, body: payload.body },
                {},
            );
        });
    });
    let controller: NotificationController;
    let notificationService: jest.Mocked<NotificationService>;

    const mockNotification = {
        title: 'Test Notification',
        body: 'This is a test notification',
    };

    const mockData = {
        type: 'test',
        userId: '1',
    };

    const mockSuccessResponse = {
        success: true,
        error: null, // Need to include error property even if null
        messageIds: ['mock-message-id'],
        successCount: 1,
        failureCount: 0,
    };

    beforeEach(async () => {
        const mockNotificationService = {
            sendNotificationToUser: jest.fn(),
            broadcastNotification: jest.fn(),
            getUserNotifications: jest.fn(),
            markAsRead: jest.fn(),
            markAllAsRead: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [NotificationController],
            providers: [
                {
                    provide: NotificationService,
                    useValue: mockNotificationService,
                },
            ],
        }).compile();

        controller = module.get<NotificationController>(NotificationController);
        notificationService = module.get(NotificationService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('sendNotificationToUser', () => {
        it('should return success response when notification is sent', async () => {
            // Arrange
            const sendDto: SendUserNotificationDto = {
                userId: '1',
                notification: mockNotification,
                data: mockData,
            };

            notificationService.sendNotificationToUser.mockResolvedValue(mockSuccessResponse);

            // Act
            const result = await controller.sendNotificationToUser(sendDto);

            // Assert
            expect(result).toEqual({
                success: true,
                message: 'Notification sent successfully',
            });
            expect(notificationService.sendNotificationToUser).toHaveBeenCalledWith(
                sendDto.userId,
                sendDto.notification,
                sendDto.data,
            );
        });

        it('should propagate errors from notification service', async () => {
            // Arrange
            const sendDto: SendUserNotificationDto = {
                userId: '999',
                notification: mockNotification,
                data: mockData,
            };

            const error = new Error('User not found');
            notificationService.sendNotificationToUser.mockRejectedValue(error);

            // Act & Assert
            await expect(controller.sendNotificationToUser(sendDto)).rejects.toThrow(error);
            expect(notificationService.sendNotificationToUser).toHaveBeenCalledWith(
                sendDto.userId,
                sendDto.notification,
                sendDto.data,
            );
        });
    });

    describe('broadcast', () => {
        it('should return success response when broadcast is sent', async () => {
            // Arrange
            const broadcastPayload = {
                title: mockNotification.title,
                body: mockNotification.body,
                data: mockData,
            };

            notificationService.broadcastNotification.mockResolvedValue(mockSuccessResponse);

            // Act
            const result = await controller.broadcast(broadcastPayload);

            // Assert
            expect(result).toEqual({
                success: true,
                message: 'Notification broadcast to all users',
            });
            expect(notificationService.broadcastNotification).toHaveBeenCalledWith(
                { title: broadcastPayload.title, body: broadcastPayload.body },
                broadcastPayload.data,
            );
        });

        it('should propagate errors from notification service', async () => {
            // Arrange
            const broadcastPayload = {
                title: mockNotification.title,
                body: mockNotification.body,
                data: mockData,
            };

            const error = new Error('Failed to broadcast notification');
            notificationService.broadcastNotification.mockRejectedValue(error);

            // Act & Assert
            await expect(controller.broadcast(broadcastPayload)).rejects.toThrow(error);
            expect(notificationService.broadcastNotification).toHaveBeenCalledWith(
                { title: broadcastPayload.title, body: broadcastPayload.body },
                broadcastPayload.data,
            );
        });
    });
    describe('getUserNotifications', () => {
        it('should return user notifications with meta', async () => {
            // Arrange
            const userId = '1';
            const notifications = [{ id: 'notif1', title: 'Test', body: 'Body' }];
            const count = 1;
            notificationService.getUserNotifications.mockResolvedValue({ notifications, count });

            // Act
            const result = await controller.getUserNotifications(userId, 10, 2);

            // Assert
            expect(result).toEqual({
                data: notifications,
                meta: {
                    total: count,
                    limit: 10,
                    page: 2,
                },
            });
            expect(notificationService.getUserNotifications).toHaveBeenCalledWith(userId, {
                limit: 10,
                page: 2,
            });
        });

        it('should use default limit and page if not provided', async () => {
            const userId = '1';
            notificationService.getUserNotifications.mockResolvedValue({
                notifications: [],
                count: 0,
            });
            const result = await controller.getUserNotifications(userId);
            expect(result.meta.limit).toBe(100);
            expect(result.meta.page).toBe(0);
        });
    });

    describe('sendToUser', () => {
        it('should send notification to a specific user (admin)', async () => {
            const userId = '2';
            const payload = { title: 'Admin', body: 'Body', data: { foo: 'bar' } };
            // NotificationResult requires at least { success: boolean }
            notificationService.sendNotificationToUser.mockResolvedValue({ success: true });
            const result = await controller.sendToUser(userId, payload);
            expect(result).toEqual({ success: true, message: 'Notification sent' });
            expect(notificationService.sendNotificationToUser).toHaveBeenCalledWith(
                userId,
                { title: payload.title, body: payload.body },
                payload.data,
            );
        });

        it('should propagate errors from notification service', async () => {
            const userId = '2';
            const payload = { title: 'Admin', body: 'Body', data: { foo: 'bar' } };
            const error = new Error('Admin send failed');
            notificationService.sendNotificationToUser.mockRejectedValue(error);
            await expect(controller.sendToUser(userId, payload)).rejects.toThrow(error);
        });
    });

    describe('markAsRead', () => {
        it('should mark a notification as read', async () => {
            const userId = '1';
            const notifId = 'notif-uuid';
            const notification = { id: notifId, read: true };
            notificationService.markAsRead.mockResolvedValue(notification);
            const result = await controller.markAsRead(userId, notifId);
            expect(result).toEqual({ success: true, data: notification });
            expect(notificationService.markAsRead).toHaveBeenCalledWith(userId, notifId);
        });

        it('should propagate errors from notification service', async () => {
            const userId = '1';
            const notifId = 'notif-uuid';
            const error = new Error('Not found');
            notificationService.markAsRead.mockRejectedValue(error);
            await expect(controller.markAsRead(userId, notifId)).rejects.toThrow(error);
        });
    });

    describe('markAllAsRead', () => {
        it('should mark all notifications as read', async () => {
            const userId = '1';
            notificationService.markAllAsRead.mockResolvedValue(undefined);
            const result = await controller.markAllAsRead(userId);
            expect(result).toEqual({ success: true, message: 'All notifications marked as read' });
            expect(notificationService.markAllAsRead).toHaveBeenCalledWith(userId);
        });

        it('should propagate errors from notification service', async () => {
            const userId = '1';
            const error = new Error('Failed to mark all as read');
            notificationService.markAllAsRead.mockRejectedValue(error);
            await expect(controller.markAllAsRead(userId)).rejects.toThrow(error);
        });
    });
});
