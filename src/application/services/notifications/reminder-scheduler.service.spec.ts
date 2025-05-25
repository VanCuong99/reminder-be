import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ReminderSchedulerService } from './reminder-scheduler.service';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { ReminderService } from './reminder.service';

describe('ReminderSchedulerService', () => {
    let service: ReminderSchedulerService;
    let redisService: RedisService;
    let reminderService: ReminderService;

    // Mock reminder keys
    const mockReminderKeys = [
        'event:reminder:event123:0',
        'event:reminder:event456:1',
        'event:reminder:event789:3',
    ];

    // Spy on Logger to prevent console output in tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ReminderSchedulerService,
                {
                    provide: RedisService,
                    useValue: {
                        get: jest.fn(),
                        executeTransaction: jest.fn(),
                        isAvailable: jest.fn().mockResolvedValue(true),
                    },
                },
                {
                    provide: ReminderService,
                    useValue: {
                        processReminder: jest.fn().mockResolvedValue(undefined),
                    },
                },
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn().mockImplementation((key: string) => {
                            if (key === 'REMINDER_SCAN_ENABLED') return 'true';
                            if (key === 'REMINDER_SCAN_BATCH_SIZE') return '10';
                            return null;
                        }),
                    },
                },
                {
                    provide: SchedulerRegistry,
                    useValue: {
                        getCronJob: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<ReminderSchedulerService>(ReminderSchedulerService);
        redisService = module.get<RedisService>(RedisService);
        reminderService = module.get<ReminderService>(ReminderService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('onModuleInit', () => {
        it('should initialize the service', async () => {
            // Mock scanForExpiredReminders to prevent error
            jest.spyOn(service as any, 'scanForExpiredReminders').mockResolvedValue(undefined);

            await service.onModuleInit();
            expect(Logger.prototype.log).toHaveBeenCalledWith('ReminderScheduler initialized');
        });

        it('should handle errors during initialization', async () => {
            jest.spyOn(service as any, 'scanForExpiredReminders').mockRejectedValue(
                new Error('Test error'),
            );

            await service.onModuleInit();

            expect(Logger.prototype.error).toHaveBeenCalled();
        });
    });

    describe('handleCron', () => {
        it('should call scanForExpiredReminders', async () => {
            // Mock the private method
            const scanSpy = jest
                .spyOn(service as any, 'scanForExpiredReminders')
                .mockResolvedValue(undefined);

            await service.handleCron();

            expect(scanSpy).toHaveBeenCalled();
        });

        it('should handle errors during scan', async () => {
            // Mock the private method to throw an error
            jest.spyOn(service as any, 'scanForExpiredReminders').mockRejectedValue(
                new Error('Test error'),
            );

            await service.handleCron();

            expect(Logger.prototype.error).toHaveBeenCalledWith(
                expect.stringContaining('Error during scheduled reminder scan'),
                expect.any(String),
            );
        });
    });

    describe('scanForExpiredReminders', () => {
        it('should skip scan if already scanning', async () => {
            // Set the service to already scanning
            Object.defineProperty(service, 'isScanning', { value: true });

            await (service as any).scanForExpiredReminders();

            // Should log but not scan
            expect(Logger.prototype.debug).toHaveBeenCalledWith(
                expect.stringContaining('Previous scan still in progress'),
            );
        });

        it('should process found reminders', async () => {
            // Mock findExpiredReminders to return some reminders
            jest.spyOn(service as any, 'findExpiredReminders').mockResolvedValue(mockReminderKeys);

            await (service as any).scanForExpiredReminders();

            // Should process each reminder
            expect(reminderService.processReminder).toHaveBeenCalledTimes(mockReminderKeys.length);
            for (const key of mockReminderKeys) {
                expect(reminderService.processReminder).toHaveBeenCalledWith(key);
            }
        });
        it('should reset scanning flag even after error', async () => {
            // Mock findExpiredReminders to throw an error
            jest.spyOn(service as any, 'findExpiredReminders').mockRejectedValue(
                new Error('Test error'),
            );

            // Make sure isScanning starts as false
            (service as any).isScanning = false;

            // The method will set isScanning to true, then an error will occur
            await expect((service as any).scanForExpiredReminders()).rejects.toThrow('Test error');

            // Should reset the flag to false even after the error
            expect((service as any).isScanning).toBe(false);
        });
    });

    describe('findExpiredReminders', () => {
        it('should return empty array if no tracking keys', async () => {
            // Mock getAllReminderTrackingKeys to return empty array
            jest.spyOn(service as any, 'getAllReminderTrackingKeys').mockResolvedValue([]);

            const result = await (service as any).findExpiredReminders();

            // Should return empty array
            expect(result).toEqual([]);
            expect(reminderService.processReminder).not.toHaveBeenCalled();
        });
        it('should skip trackingKey if remindersJson is null', async () => {
            const mockTrackingKey = 'event:tracking:event123';
            jest.spyOn(service as any, 'getAllReminderTrackingKeys').mockResolvedValue([
                mockTrackingKey,
            ]);
            jest.spyOn(redisService, 'get').mockResolvedValueOnce(null); // remindersJson is null
            const result = await (service as any).findExpiredReminders();
            expect(result).toEqual([]);
            expect(redisService.get).toHaveBeenCalledWith(mockTrackingKey);
        });
        it('should skip reminderKey if reminderData is null', async () => {
            const mockTrackingKey = 'event:tracking:event123';
            const reminderKeys = ['reminder:1', 'reminder:2'];
            jest.spyOn(service as any, 'getAllReminderTrackingKeys').mockResolvedValue([
                mockTrackingKey,
            ]);
            jest.spyOn(redisService, 'get').mockImplementation((key: string) => {
                if (key === mockTrackingKey) return Promise.resolve(JSON.stringify(reminderKeys));
                // For reminder keys, return null
                return Promise.resolve(null);
            });
            const result = await (service as any).findExpiredReminders();
            expect(result).toEqual([]);
            expect(redisService.get).toHaveBeenCalledWith(reminderKeys[0]);
            expect(redisService.get).toHaveBeenCalledWith(reminderKeys[1]);
        });

        it('should find expired reminders', async () => {
            // Create test data
            const mockTrackingKey = 'event:tracking:event123';
            const mockTracking = JSON.stringify(mockReminderKeys);
            const now = Date.now();

            // Mock getAllReminderTrackingKeys to return a tracking key
            jest.spyOn(service as any, 'getAllReminderTrackingKeys').mockResolvedValue([
                mockTrackingKey,
            ]);

            // Mock redisService.get to return data
            jest.spyOn(redisService, 'get').mockImplementation((key: string) => {
                if (key === mockTrackingKey) {
                    return Promise.resolve(mockTracking);
                }

                // For each reminder key
                const reminderData = {
                    scheduledTime: now - 1000, // Already expired
                };
                return Promise.resolve(JSON.stringify(reminderData));
            });

            const result = await (service as any).findExpiredReminders();

            // Should return the expired reminders
            expect(result).toHaveLength(mockReminderKeys.length);
            expect(redisService.get).toHaveBeenCalledTimes(mockReminderKeys.length + 1); // tracking key + each reminder
        });

        it('should handle errors during reminder scan', async () => {
            // Mock getAllReminderTrackingKeys to throw an error
            jest.spyOn(service as any, 'getAllReminderTrackingKeys').mockRejectedValue(
                new Error('Test error'),
            );

            const result = await (service as any).findExpiredReminders();

            // Should return empty array on error
            expect(result).toEqual([]);
            expect(Logger.prototype.error).toHaveBeenCalled();
        });
    });

    describe('getAllReminderTrackingKeys', () => {
        it('should return empty array', async () => {
            // The method always returns an empty array in the implementation
            const result = await (service as any).getAllReminderTrackingKeys();

            expect(result).toEqual([]);
        });
    });
});
