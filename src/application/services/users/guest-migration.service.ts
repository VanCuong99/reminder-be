import { Injectable, Logger } from '@nestjs/common';
import { EventService } from '../events/event.service';

@Injectable()
export class GuestMigrationService {
    private readonly logger = new Logger(GuestMigrationService.name);

    constructor(private readonly eventService: EventService) {}

    /**
     * Migrate all data from a guest device to an authenticated user
     * @param userId The ID of the authenticated user
     * @param deviceId The device ID of the guest user
     */
    async migrateGuestToUser(
        userId: string,
        deviceId: string,
    ): Promise<{ migratedEvents: number }> {
        try {
            this.logger.log(`Starting migration from guest device ${deviceId} to user ${userId}`);

            // Migrate events
            const migratedEvents = await this.eventService.migrateGuestEvents(userId, deviceId);

            // Here you could add more migration steps for other data types
            // For example: migrateGuestPreferences, migrateGuestNotifications, etc.

            this.logger.log(`Migration completed for guest device ${deviceId} to user ${userId}`);

            return {
                migratedEvents,
            };
        } catch (error) {
            this.logger.error(`Error during guest migration: ${error.message}`, error.stack);
            throw error;
        }
    }
}
