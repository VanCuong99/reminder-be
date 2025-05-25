import { Test, TestingModule } from '@nestjs/testing';
import { EventNotificationService } from './event-notification.service';
import { NotificationService } from '../../../infrastructure/messaging/notification.service';
import { UserService } from '../users/user.service';
import { GuestDeviceService } from '../guest-device/guest-device.service';
import { Event } from '../../../domain/entities/event.entity';
import { User } from '../../../domain/entities/user.entity';
import { GuestDevice } from '../../../domain/entities/guest-device.entity';

describe('EventNotificationService', () => {
    let service: EventNotificationService;
    let notificationService: NotificationService;
    let userService: UserService;
    let guestDeviceService: GuestDeviceService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EventNotificationService,
                {
                    provide: NotificationService,
                    useValue: {
                        sendNotificationToUser: jest.fn(),
                        sendNotificationToDevice: jest.fn(),
                        sendNotificationToUsers: jest.fn().mockResolvedValue({ success: true }),
                        sendNotificationToBatch: jest.fn().mockResolvedValue({ success: true }),
                    },
                },
                {
                    provide: UserService,
                    useValue: {
                        findById: jest.fn(),
                    },
                },
                {
                    provide: GuestDeviceService,
                    useValue: {
                        findOrCreate: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<EventNotificationService>(EventNotificationService);
        notificationService = module.get<NotificationService>(NotificationService);
        userService = module.get<UserService>(UserService);
        guestDeviceService = module.get<GuestDeviceService>(GuestDeviceService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('createEventNotification', () => {
        it('should send notification to users (batch)', async () => {
            // Arrange
            const event = { id: '1', name: 'Test Event', userId: 'user1' } as Event;
            const sender = { id: 'sender2', username: 'Test Sender' } as User;
            // Act
            await service.createEventNotification(event, sender);
            // Assert
            expect(notificationService.sendNotificationToUsers).toHaveBeenCalledWith(
                ['user1'],
                {
                    title: `New event: ${event.name}`,
                    body: `You have been invited to ${event.name} by ${sender.username}`,
                },
                {
                    type: 'event',
                    eventId: event.id,
                },
            );
        });

        it('should skip sending notification when user is the sender', async () => {
            // Arrange
            const event = { id: '1', name: 'Test Event', userId: 'user1' } as Event;
            const sender = { id: 'user1', username: 'Test Sender' } as User;
            // Act
            await service.createEventNotification(event, sender);
            // Assert
            expect(notificationService.sendNotificationToUsers).not.toHaveBeenCalled();
        });

        it('should handle events with no userId', async () => {
            // Arrange - event without userId
            const event = { id: '1', name: 'Test Event' } as Event;
            const sender = { id: 'sender1', username: 'Test Sender' } as User;
            // Act
            await service.createEventNotification(event, sender);
            // Assert
            expect(notificationService.sendNotificationToUsers).not.toHaveBeenCalled();
        });

        it('should handle sender without username', async () => {
            // Arrange
            const event = { id: '1', name: 'Test Event', userId: 'user1' } as Event;
            const sender = { id: 'sender2' } as User;
            // Act
            await service.createEventNotification(event, sender);
            // Assert
            expect(notificationService.sendNotificationToUsers).toHaveBeenCalledWith(
                ['user1'],
                {
                    title: `New event: ${event.name}`,
                    body: `You have been invited to ${event.name} by another user`,
                },
                expect.any(Object),
            );
        });

        it('should handle error in notification service', async () => {
            // Arrange
            const event = { id: '1', name: 'Test Event', userId: 'user1' } as Event;
            const sender = { id: 'sender2', username: 'Test Sender' } as User;
            jest.spyOn(notificationService, 'sendNotificationToUsers').mockRejectedValueOnce(
                new Error('Notification error'),
            );
            // Act & Assert
            await expect(service.createEventNotification(event, sender)).rejects.toThrow(
                'Error creating event notification',
            );
        });
    });

    describe('createGuestEventNotification', () => {
        it('should send notification to guest devices (batch)', async () => {
            // Arrange
            const event = { id: '1', name: 'Test Event' } as Event;
            const deviceIds = ['device1', 'device2'];
            const devices = [
                {
                    id: 'uuid-1',
                    deviceId: 'device1',
                    firebaseToken: 'token1',
                    timezone: 'UTC',
                    events: [],
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    isActive: true,
                } as GuestDevice,
                {
                    id: 'uuid-2',
                    deviceId: 'device2',
                    firebaseToken: 'token2',
                    timezone: 'UTC',
                    events: [],
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    isActive: true,
                } as GuestDevice,
            ];
            jest.spyOn(guestDeviceService, 'findOrCreate').mockImplementation(
                async (id: string) => {
                    return devices.find(d => d.deviceId === id) as GuestDevice;
                },
            );
            // Act
            await service.createGuestEventNotification(event, deviceIds);
            // Assert
            expect(notificationService.sendNotificationToBatch).toHaveBeenCalledWith(
                ['token1', 'token2'],
                `New event: ${event.name}`,
                `You have been invited to ${event.name}`,
                {
                    type: 'event',
                    eventId: event.id,
                },
            );
        });

        it('should skip if no deviceIds are provided', async () => {
            // Arrange
            const event = { id: '1', name: 'Test Event' } as Event;
            // Act
            await service.createGuestEventNotification(event, []);
            // Assert
            expect(notificationService.sendNotificationToBatch).not.toHaveBeenCalled();
        });

        it('should skip devices without firebase token (batch)', async () => {
            // Arrange
            const event = { id: '1', name: 'Test Event' } as Event;
            const deviceIds = ['device1', 'device2'];
            const devices = [
                {
                    id: 'uuid-1',
                    deviceId: 'device1',
                    firebaseToken: null,
                    timezone: 'UTC',
                    events: [],
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    isActive: true,
                } as GuestDevice,
                {
                    id: 'uuid-2',
                    deviceId: 'device2',
                    firebaseToken: 'token2',
                    timezone: 'UTC',
                    events: [],
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    isActive: true,
                } as GuestDevice,
            ];
            jest.spyOn(guestDeviceService, 'findOrCreate').mockImplementation(
                async (id: string) => {
                    return devices.find(d => d.deviceId === id) as GuestDevice;
                },
            );
            // Act
            await service.createGuestEventNotification(event, deviceIds);
            // Assert
            expect(notificationService.sendNotificationToBatch).toHaveBeenCalledWith(
                ['token2'],
                `New event: ${event.name}`,
                `You have been invited to ${event.name}`,
                expect.any(Object),
            );
        });

        it('should handle multiple device IDs (batch)', async () => {
            // Arrange
            const event = { id: '1', name: 'Test Event' } as Event;
            const deviceIds = ['device1', 'device2'];
            const devices = [
                {
                    id: 'device-uuid-1',
                    deviceId: 'device1',
                    firebaseToken: 'token1',
                    timezone: 'UTC',
                    events: [],
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    isActive: true,
                },
                {
                    id: 'device-uuid-2',
                    deviceId: 'device2',
                    firebaseToken: 'token2',
                    timezone: 'UTC',
                    events: [],
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    isActive: true,
                },
            ];
            jest.spyOn(guestDeviceService, 'findOrCreate').mockImplementation(
                async (id: string) => {
                    return devices.find(d => d.deviceId === id) as GuestDevice;
                },
            );
            // Act
            await service.createGuestEventNotification(event, deviceIds);
            // Assert
            expect(notificationService.sendNotificationToBatch).toHaveBeenCalledWith(
                ['token1', 'token2'],
                `New event: ${event.name}`,
                `You have been invited to ${event.name}`,
                {
                    type: 'event',
                    eventId: event.id,
                },
            );
        });

        it('should handle error in guest device service', async () => {
            // Arrange
            const event = { id: '1', name: 'Test Event' } as Event;
            const deviceId = 'device1';
            jest.spyOn(guestDeviceService, 'findOrCreate').mockRejectedValueOnce(
                new Error('Device error'),
            );
            // Act & Assert
            await expect(service.createGuestEventNotification(event, [deviceId])).rejects.toThrow(
                'Error creating guest event notification',
            );
        });
    });

    describe('createEventUpdateNotification', () => {
        it('should send update notification to users (batch)', async () => {
            // Arrange
            const event = { id: '1', name: 'Test Event', userId: 'user1' } as Event;
            const sender = { id: 'sender1', username: 'Test Sender' } as User;
            // Act
            await service.createEventUpdateNotification(event, sender);
            // Assert
            expect(notificationService.sendNotificationToUsers).toHaveBeenCalledWith(
                ['user1'],
                {
                    title: `Event updated: ${event.name}`,
                    body: `${event.name} has been updated by ${sender.username}`,
                },
                {
                    type: 'event_update',
                    eventId: event.id,
                },
            );
        });

        it('should skip sending notification when user is the sender', async () => {
            // Arrange
            const event = { id: '1', name: 'Test Event', userId: 'user1' } as Event;
            const sender = { id: 'user1', username: 'Test Sender' } as User; // Same ID as user
            // Act
            await service.createEventUpdateNotification(event, sender);
            // Assert
            expect(notificationService.sendNotificationToUsers).not.toHaveBeenCalled();
        });

        it('should handle events with no userId', async () => {
            // Arrange - event without userId
            const event = { id: '1', name: 'Test Event' } as Event;
            const sender = { id: 'sender1', username: 'Test Sender' } as User;

            // Act
            await service.createEventUpdateNotification(event, sender);

            // Assert - no findById call should happen
            expect(userService.findById).not.toHaveBeenCalled();
        });

        it('should handle sender without username', async () => {
            // Arrange
            const event = { id: '1', name: 'Test Event', userId: 'user1' } as Event;
            const sender = { id: 'sender1' } as User; // No username
            // Act
            await service.createEventUpdateNotification(event, sender);
            // Assert
            expect(notificationService.sendNotificationToUsers).toHaveBeenCalledWith(
                ['user1'],
                {
                    title: `Event updated: ${event.name}`,
                    body: `${event.name} has been updated by another user`,
                },
                expect.any(Object),
            );
        });

        it('should handle error in notification service', async () => {
            // Arrange
            const event = { id: '1', name: 'Test Event', userId: 'user1' } as Event;
            const sender = { id: 'sender2', username: 'Test Sender' } as User;
            jest.spyOn(notificationService, 'sendNotificationToUsers').mockRejectedValueOnce(
                new Error('Notification error'),
            );
            // Act & Assert
            await expect(service.createEventUpdateNotification(event, sender)).rejects.toThrow(
                'Error creating event update notification',
            );
        });
    });

    describe('createGuestEventUpdateNotification', () => {
        it('should send update notification to guest devices (batch)', async () => {
            // Arrange
            const event = { id: '1', name: 'Test Event' } as Event;
            const deviceIds = ['device1'];
            const devices = [
                {
                    id: 'device-uuid-2',
                    deviceId: 'device1',
                    firebaseToken: 'token1',
                    timezone: 'UTC',
                    events: [],
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    isActive: true,
                },
            ];
            jest.spyOn(guestDeviceService, 'findOrCreate').mockImplementation(
                async (id: string) => {
                    return devices.find(d => d.deviceId === id) as GuestDevice;
                },
            );
            // Act
            await service.createGuestEventUpdateNotification(event, deviceIds);
            // Assert
            expect(notificationService.sendNotificationToBatch).toHaveBeenCalledWith(
                ['token1'],
                `Event updated: ${event.name}`,
                `${event.name} has been updated`,
                {
                    type: 'event_update',
                    eventId: event.id,
                },
            );
        });

        it('should skip devices without firebase token (batch)', async () => {
            // Arrange
            const event = { id: '1', name: 'Test Event' } as Event;
            const deviceIds = ['device1', 'device2'];
            const devices = [
                {
                    id: 'device-uuid-1',
                    deviceId: 'device1',
                    firebaseToken: null,
                    timezone: 'UTC',
                    events: [],
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    isActive: true,
                },
                {
                    id: 'device-uuid-2',
                    deviceId: 'device2',
                    firebaseToken: 'token2',
                    timezone: 'UTC',
                    events: [],
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    isActive: true,
                },
            ];
            jest.spyOn(guestDeviceService, 'findOrCreate').mockImplementation(
                async (id: string) => {
                    return devices.find(d => d.deviceId === id) as GuestDevice;
                },
            );
            // Act
            await service.createGuestEventUpdateNotification(event, deviceIds);
            // Assert
            expect(notificationService.sendNotificationToBatch).toHaveBeenCalledWith(
                ['token2'],
                `Event updated: ${event.name}`,
                `${event.name} has been updated`,
                expect.any(Object),
            );
        });

        it('should handle multiple device IDs (batch)', async () => {
            // Arrange
            const event = { id: '1', name: 'Test Event' } as Event;
            const deviceIds = ['device1', 'device2'];
            const devices = [
                {
                    id: 'device-uuid-1',
                    deviceId: 'device1',
                    firebaseToken: 'token1',
                    timezone: 'UTC',
                    events: [],
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    isActive: true,
                },
                {
                    id: 'device-uuid-2',
                    deviceId: 'device2',
                    firebaseToken: 'token2',
                    timezone: 'UTC',
                    events: [],
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    isActive: true,
                },
            ];
            jest.spyOn(guestDeviceService, 'findOrCreate').mockImplementation(
                async (id: string) => {
                    return devices.find(d => d.deviceId === id) as GuestDevice;
                },
            );
            // Act
            await service.createGuestEventUpdateNotification(event, deviceIds);
            // Assert
            expect(notificationService.sendNotificationToBatch).toHaveBeenCalledWith(
                ['token1', 'token2'],
                `Event updated: ${event.name}`,
                `${event.name} has been updated`,
                {
                    type: 'event_update',
                    eventId: event.id,
                },
            );
        });

        it('should handle error in guest device service', async () => {
            // Arrange
            const event = { id: '1', name: 'Test Event' } as Event;
            const deviceId = 'device1';

            jest.spyOn(guestDeviceService, 'findOrCreate').mockRejectedValueOnce(
                new Error('Device error'),
            );

            // Act & Assert
            await expect(
                service.createGuestEventUpdateNotification(event, [deviceId]),
            ).rejects.toThrow('Error creating guest event update notification');
        });
    });
});
