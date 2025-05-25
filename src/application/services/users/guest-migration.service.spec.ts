import { Test, TestingModule } from '@nestjs/testing';
import { GuestMigrationService } from './guest-migration.service';
import { EventService } from '../events/event.service';
import { Logger } from '@nestjs/common';

describe('GuestMigrationService', () => {
    let service: GuestMigrationService;
    let eventService: EventService;

    // Spy on Logger to prevent console output in tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GuestMigrationService,
                {
                    provide: EventService,
                    useValue: {
                        migrateGuestEvents: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<GuestMigrationService>(GuestMigrationService);
        eventService = module.get<EventService>(EventService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('migrateGuestToUser', () => {
        it('should migrate guest events successfully', async () => {
            // Setup mock
            jest.spyOn(eventService, 'migrateGuestEvents').mockResolvedValue(5);

            const userId = 'user123';
            const deviceId = 'device456';

            const result = await service.migrateGuestToUser(userId, deviceId);

            expect(eventService.migrateGuestEvents).toHaveBeenCalledWith(userId, deviceId);
            expect(result).toEqual({ migratedEvents: 5 });
        });

        it('should handle errors during migration', async () => {
            // Setup mock to throw an error
            const errorMessage = 'Database error during migration';
            jest.spyOn(eventService, 'migrateGuestEvents').mockRejectedValue(
                new Error(errorMessage),
            );

            const userId = 'user123';
            const deviceId = 'device456';

            await expect(service.migrateGuestToUser(userId, deviceId)).rejects.toThrow(
                errorMessage,
            );
        });

        it('should handle migration with no events', async () => {
            // Setup mock to return 0 events
            jest.spyOn(eventService, 'migrateGuestEvents').mockResolvedValue(0);

            const userId = 'user123';
            const deviceId = 'device456';

            const result = await service.migrateGuestToUser(userId, deviceId);

            expect(eventService.migrateGuestEvents).toHaveBeenCalledWith(userId, deviceId);
            expect(result).toEqual({ migratedEvents: 0 });
        });
    });
});
