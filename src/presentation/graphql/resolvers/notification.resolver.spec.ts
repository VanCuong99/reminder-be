import { Test, TestingModule } from '@nestjs/testing';
import { NotificationResolver } from './notification.resolver';
import { NotificationService } from '../../../infrastructure/messaging/notification.service';
import { NotificationInput } from '../types/notification/inputs/notification.input';
import { NotificationResult } from '../types/notification/notification-result.type';

describe('NotificationResolver', () => {
    let resolver: NotificationResolver;
    let notificationService: jest.Mocked<NotificationService>;

    const mockNotificationService = {
        sendNotificationToUser: jest.fn(),
        broadcastNotification: jest.fn(),
        sendTopicNotification: jest.fn(),
        sendNotification: jest.fn(),
    };

    const mockNotificationInput: NotificationInput = {
        title: 'Test Title',
        body: 'Test Body',
        data: { key: 'value' },
    };

    const mockNotificationResult: NotificationResult = {
        success: true,
        messageIds: ['test-message-id'],
        successCount: 1,
        failureCount: 0,
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                NotificationResolver,
                {
                    provide: NotificationService,
                    useValue: mockNotificationService,
                },
            ],
        }).compile();

        resolver = module.get<NotificationResolver>(NotificationResolver);
        notificationService = module.get(NotificationService);
    });

    describe('sendNotificationToUser', () => {
        it('should call notificationService.sendNotificationToUser with correct parameters', async () => {
            // Arrange
            const userId = 'user-123';
            mockNotificationService.sendNotificationToUser.mockResolvedValue(
                mockNotificationResult,
            );

            // Act
            const result = await resolver.sendNotificationToUser(userId, mockNotificationInput);

            // Assert
            expect(notificationService.sendNotificationToUser).toHaveBeenCalledWith(
                userId,
                mockNotificationInput,
                mockNotificationInput.data,
            );
            expect(result).toEqual(mockNotificationResult);
        });
    });

    describe('broadcastNotification', () => {
        it('should call notificationService.broadcastNotification with correct parameters', async () => {
            // Arrange
            mockNotificationService.broadcastNotification.mockResolvedValue(mockNotificationResult);

            // Act
            const result = await resolver.broadcastNotification(mockNotificationInput);

            // Assert
            expect(notificationService.broadcastNotification).toHaveBeenCalledWith(
                mockNotificationInput,
                mockNotificationInput.data,
            );
            expect(result).toEqual(mockNotificationResult);
        });
    });

    describe('sendTopicNotification', () => {
        it('should call notificationService.sendTopicNotification with correct parameters', async () => {
            // Arrange
            const topic = 'news';
            mockNotificationService.sendTopicNotification.mockResolvedValue(mockNotificationResult);

            // Act
            const result = await resolver.sendTopicNotification(topic, mockNotificationInput);

            // Assert
            expect(notificationService.sendTopicNotification).toHaveBeenCalledWith(
                topic,
                mockNotificationInput,
                mockNotificationInput.data,
            );
            expect(result).toEqual(mockNotificationResult);
        });
    });

    describe('sendNotification', () => {
        it('should call notificationService.sendNotification with correct parameters', async () => {
            // Arrange
            const token = 'device-token-123';
            mockNotificationService.sendNotification.mockResolvedValue(mockNotificationResult);

            // Act
            const result = await resolver.sendNotification(token, mockNotificationInput);

            // Assert
            expect(notificationService.sendNotification).toHaveBeenCalledWith(
                token,
                mockNotificationInput,
                mockNotificationInput.data,
            );
            expect(result).toEqual(mockNotificationResult);
        });
    });

    describe('error handling', () => {
        it('should propagate errors from the notification service', async () => {
            // Arrange
            const userId = 'user-123';
            const errorMessage = 'Failed to send notification';
            mockNotificationService.sendNotificationToUser.mockRejectedValue(
                new Error(errorMessage),
            );

            // Act & Assert
            await expect(
                resolver.sendNotificationToUser(userId, mockNotificationInput),
            ).rejects.toThrow(errorMessage);
        });
    });
});
