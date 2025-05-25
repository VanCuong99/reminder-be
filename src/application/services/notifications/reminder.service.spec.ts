import { Test, TestingModule } from '@nestjs/testing';
import { ReminderService } from './reminder.service';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { FirebaseService } from '../../../infrastructure/firestore/firebase.service';
import { NotificationService } from '../../../infrastructure/messaging/notification.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../../../domain/entities/event.entity';
import { Logger } from '@nestjs/common';

describe('ReminderService', () => {
    let service: ReminderService;
    let redisService: RedisService;

    let notificationService: NotificationService;
    let eventRepository: Repository<Event>;
    // Mock event data
    const mockEvent = {
        id: 'event123',
        name: 'Test Event',
        description: 'Test event description',
        date: new Date('2025-12-25T12:00:00Z'),
        userId: 'user123',
        deviceId: null,
        notificationSettings: {
            enabled: true,
            reminders: [0, 1, 3, 7], // days before event
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        isAuthenticatedUserEvent: () => true,
        isGuestUserEvent: () => false,
    } as Event;

    // Mock reminder data
    const mockReminderData = {
        eventId: 'event123',
        userId: 'user123',
        deviceId: null,
        eventName: 'Test Event',
        eventDate: '2025-12-25T12:00:00.000Z',
        scheduledTime: new Date('2025-12-25T12:00:00Z').getTime(),
        daysBeforeEvent: 0,
        createdAt: expect.any(Number),
    };

    // Spy on Logger to prevent console output in tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ReminderService,
                {
                    provide: RedisService,
                    useValue: {
                        set: jest.fn(),
                        get: jest.fn(),
                        delete: jest.fn(),
                    },
                },
                {
                    provide: FirebaseService,
                    useValue: {
                        // Add any methods you need to mock
                    },
                },
                {
                    provide: NotificationService,
                    useValue: {
                        sendNotificationToUser: jest.fn(),
                        sendNotificationToDevice: jest.fn(),
                    },
                },
                {
                    provide: getRepositoryToken(Event),
                    useValue: {
                        findOne: jest.fn(),
                    },
                },
            ],
        }).compile();
        service = module.get<ReminderService>(ReminderService);
        redisService = module.get<RedisService>(RedisService);
        notificationService = module.get<NotificationService>(NotificationService);
        eventRepository = module.get<Repository<Event>>(getRepositoryToken(Event));
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('scheduleEventReminders', () => {
        it('should not schedule any reminders if all reminders are in the past', async () => {
            jest.spyOn(service as any, 'removeEventReminders').mockResolvedValue(undefined);
            redisService.executeTransaction = jest.fn().mockResolvedValue(undefined);
            // Set event date to now, and reminders to [10, 20] days before (all in the past)
            const now = new Date();
            jest.spyOn(Date, 'now').mockReturnValue(now.getTime());
            const event = {
                ...mockEvent,
                date: new Date(now.getTime() + 1000), // event is 1 second in the future
                notificationSettings: { reminders: [2], enabled: true },
            } as Event;
            // 2 days before is in the past
            await service.scheduleEventReminders(event);
            expect(redisService.executeTransaction).not.toHaveBeenCalled();
        });

        it('should not call executeTransaction if commands is empty', async () => {
            jest.spyOn(service as any, 'removeEventReminders').mockResolvedValue(undefined);
            redisService.executeTransaction = jest.fn().mockResolvedValue(undefined);
            // Set event date to now, and reminders to []
            const now = new Date();
            jest.spyOn(Date, 'now').mockReturnValue(now.getTime());
            const event = {
                ...mockEvent,
                date: new Date(now.getTime() + 1000),
                notificationSettings: { reminders: [], enabled: true },
            } as Event;
            await service.scheduleEventReminders(event);
            expect(redisService.executeTransaction).not.toHaveBeenCalled();
        });
        it('should schedule reminders based on event notification settings', async () => {
            // Setup mocks
            jest.spyOn(service as any, 'removeEventReminders').mockResolvedValue(undefined);
            redisService.executeTransaction = jest.fn().mockResolvedValue(undefined);

            // Use a specific date for the test to verify calculations
            const mockDate = new Date('2025-05-16T10:00:00Z'); // Current date from context
            jest.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());

            // Event is in the future, should schedule reminders
            await service.scheduleEventReminders(mockEvent);

            // All 4 reminders (0, 1, 3, 7 days before) should be scheduled, plus 1 tracking key
            // So, 5 commands in a single transaction
            expect(redisService.executeTransaction).toHaveBeenCalledTimes(1);
            const mockExecute = redisService.executeTransaction as jest.Mock;
            const commands = mockExecute.mock.calls[0][0];
            expect(commands.length).toBe(5); // 4 reminders + 1 tracking key

            // Check that the tracking key is present in the batch
            const trackingKey = `event:tracking:${mockEvent.id}`;
            expect(commands.some((cmd: any[]) => cmd[0] === 'set' && cmd[1] === trackingKey)).toBe(
                true,
            );
        });

        it('should log error if redisService.set throws', async () => {
            jest.spyOn(service as any, 'removeEventReminders').mockResolvedValue(undefined);
            jest.spyOn(redisService, 'set').mockImplementation(() => {
                throw new Error('Redis error');
            });
            const loggerSpy = jest.spyOn(service['logger'], 'error');
            await service.scheduleEventReminders(mockEvent);
            expect(loggerSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to schedule reminders for event'),
                expect.any(String),
            );
        });

        it('should not schedule reminders if event has no date', async () => {
            const eventWithNoDate = { ...mockEvent, date: null } as Event;
            await service.scheduleEventReminders(eventWithNoDate);
            expect(redisService.set).not.toHaveBeenCalled();
        });

        it('should not schedule reminders if notifications are disabled', async () => {
            const disabledNotifications = {
                ...mockEvent,
                notificationSettings: { enabled: false, reminders: [0, 1] },
            } as Event;

            await service.scheduleEventReminders(disabledNotifications);
            expect(redisService.set).not.toHaveBeenCalled();
        });
        it('should remove old reminders before scheduling new ones', async () => {
            const removeEventRemindersSpy = jest
                .spyOn(service, 'removeEventReminders')
                .mockResolvedValue(undefined);

            await service.scheduleEventReminders(mockEvent);

            expect(removeEventRemindersSpy).toHaveBeenCalledWith(mockEvent.id);
        });
    });

    describe('removeEventReminders', () => {
        it('should not call executeTransaction if reminderKeys is an empty array', async () => {
            const eventId = 'event123';
            const trackingKey = `event:tracking:${eventId}`;
            redisService.get = jest.fn().mockResolvedValue(JSON.stringify([]));
            redisService.executeTransaction = jest.fn();
            await service.removeEventReminders(eventId);
            expect(redisService.executeTransaction).not.toHaveBeenCalled();
        });
        it('should remove all reminders for an event (batch delete)', async () => {
            const mockReminderKeys = ['event:reminder:event123:0', 'event:reminder:event123:1'];
            const reminderKeysJson = JSON.stringify(mockReminderKeys);
            const eventId = 'event123';
            const trackingKey = `event:tracking:${eventId}`;
            // Mock redisService.get to return reminderKeysJson
            redisService.get = jest.fn().mockResolvedValue(reminderKeysJson);
            // Mock redisService.executeTransaction
            redisService.executeTransaction = jest.fn().mockResolvedValue(undefined);

            await service.removeEventReminders(eventId);

            // Should call get with trackingKey
            expect(redisService.get).toHaveBeenCalledWith(trackingKey);
            // Should call executeTransaction with delete commands for each reminder and trackingKey
            expect(redisService.executeTransaction).toHaveBeenCalledWith([
                ['del', 'event:reminder:event123:0'],
                ['del', 'event:reminder:event123:1'],
                ['del', trackingKey],
            ]);
        });

        it('should log error if redisService.get throws', async () => {
            const eventId = 'event123';
            const error = new Error('Redis error');
            redisService.get = jest.fn().mockRejectedValue(error);
            // Mock logger
            const loggerSpy = jest.spyOn(service['logger'], 'error');
            await service.removeEventReminders(eventId);
            expect(loggerSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to remove reminders for event'),
                expect.any(String),
            );
        });

        it('should handle case where no reminders exist', async () => {
            const eventId = 'event123';
            redisService.get = jest.fn().mockResolvedValue(null);
            // Should not throw or call executeTransaction
            redisService.executeTransaction = jest.fn();
            await service.removeEventReminders(eventId);
            expect(redisService.executeTransaction).not.toHaveBeenCalled();
        });
    });

    describe('processReminder', () => {
        it('should log warning if neither userId nor deviceId is present', async () => {
            const reminderKey = 'event:reminder:event123:0';
            const reminderData = JSON.stringify({
                ...mockReminderData,
                userId: null,
                deviceId: null,
            });
            jest.spyOn(redisService, 'get').mockResolvedValue(reminderData);
            jest.spyOn(eventRepository, 'findOne').mockResolvedValue(mockEvent);
            const loggerSpy = jest.spyOn(service['logger'], 'warn');
            await service.processReminder(reminderKey);
            expect(loggerSpy).toHaveBeenCalledWith(
                expect.stringContaining('No user or device ID found for reminder'),
            );
        });
        it('should send notification to a user when reminder is processed', async () => {
            // Setup mocks
            const reminderKey = 'event:reminder:event123:0';
            const reminderData = JSON.stringify(mockReminderData);

            jest.spyOn(redisService, 'get').mockResolvedValue(reminderData);
            jest.spyOn(eventRepository, 'findOne').mockResolvedValue(mockEvent);

            await service.processReminder(reminderKey);

            // Should send notification to user
            expect(notificationService.sendNotificationToUser).toHaveBeenCalledWith(
                'user123',
                {
                    title: 'Event happening now: Test Event',
                    body: 'Your event "Test Event" is happening now!',
                },
                { eventId: 'event123', type: 'reminder', daysBeforeEvent: '0' },
            );

            // Should delete the reminder after processing
            expect(redisService.delete).toHaveBeenCalledWith(reminderKey);
        });

        it('should log warning if neither userId nor deviceId is present', async () => {
            const reminderKey = 'event:reminder:event123:0';
            const reminderData = JSON.stringify({
                ...mockReminderData,
                userId: null,
                deviceId: null,
            });
            jest.spyOn(redisService, 'get').mockResolvedValue(reminderData);
            jest.spyOn(eventRepository, 'findOne').mockResolvedValue(mockEvent);
            const loggerSpy = jest.spyOn(service['logger'], 'warn');
            await service.processReminder(reminderKey);
            expect(loggerSpy).toHaveBeenCalledWith(
                expect.stringContaining('No user or device ID found for reminder'),
            );
        });

        it('should log error if redisService.get throws', async () => {
            const reminderKey = 'event:reminder:event123:0';
            jest.spyOn(redisService, 'get').mockImplementation(() => {
                throw new Error('Redis get error');
            });
            const loggerSpy = jest.spyOn(service['logger'], 'error');
            await service.processReminder(reminderKey);
            expect(loggerSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to process reminder'),
                expect.any(String),
            );
        });
        describe('updateEventReminders', () => {
            it('should call scheduleEventReminders', async () => {
                const scheduleSpy = jest
                    .spyOn(service, 'scheduleEventReminders')
                    .mockResolvedValue(undefined);
                await service.updateEventReminders(mockEvent);
                expect(scheduleSpy).toHaveBeenCalledWith(mockEvent);
            });

            it('should log error if scheduleEventReminders throws', async () => {
                jest.spyOn(service, 'scheduleEventReminders').mockImplementation(() => {
                    throw new Error('Schedule error');
                });
                const loggerSpy = jest.spyOn(service['logger'], 'error');
                await service.updateEventReminders(mockEvent);
                expect(loggerSpy).toHaveBeenCalledWith(
                    expect.stringContaining('Failed to schedule reminders for event'),
                    expect.any(String),
                );
            });
        });

        it('should send notification to a device when reminder is for a guest user', async () => {
            // Setup mocks
            const reminderKey = 'event:reminder:event123:1';
            const guestReminderData = {
                ...mockReminderData,
                userId: null,
                deviceId: 'device123',
                daysBeforeEvent: 1,
            };

            jest.spyOn(redisService, 'get').mockResolvedValue(JSON.stringify(guestReminderData));
            jest.spyOn(eventRepository, 'findOne').mockResolvedValue({
                ...mockEvent,
                userId: null,
                deviceId: 'device123',
                isAuthenticatedUserEvent: () => false,
                isGuestUserEvent: () => true,
            });

            await service.processReminder(reminderKey);

            // Should send notification to device
            expect(notificationService.sendNotificationToDevice).toHaveBeenCalledWith(
                'device123',
                'Upcoming event: Test Event',
                'Your event "Test Event" is happening in 1 day(s).',
                { eventId: 'event123', type: 'reminder', daysBeforeEvent: '1' },
            );
        });

        it('should not send notification if event no longer exists', async () => {
            const reminderKey = 'event:reminder:event123:0';

            jest.spyOn(redisService, 'get').mockResolvedValue(JSON.stringify(mockReminderData));
            jest.spyOn(eventRepository, 'findOne').mockResolvedValue(null);

            await service.processReminder(reminderKey);

            // Should not send any notification
            expect(notificationService.sendNotificationToUser).not.toHaveBeenCalled();
            expect(notificationService.sendNotificationToDevice).not.toHaveBeenCalled();

            // Should delete the reminder
            expect(redisService.delete).toHaveBeenCalledWith(reminderKey);
        });

        it('should handle case where reminder data is missing', async () => {
            jest.spyOn(redisService, 'get').mockResolvedValue(null);

            await service.processReminder('event:reminder:nonexistent:0');

            // No notifications should be sent
            expect(notificationService.sendNotificationToUser).not.toHaveBeenCalled();
            expect(notificationService.sendNotificationToDevice).not.toHaveBeenCalled();
        });
    });
});
