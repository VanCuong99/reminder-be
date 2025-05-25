import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { ReminderService } from './reminder.service';

@Injectable()
export class ReminderSchedulerService implements OnModuleInit {
    private readonly logger = new Logger(ReminderSchedulerService.name);
    private readonly reminderPrefix = 'event:reminder:';
    private isScanning = false;

    constructor(
        private readonly redisService: RedisService,
        private readonly reminderService: ReminderService,
        private readonly configService: ConfigService,
        private readonly schedulerRegistry: SchedulerRegistry,
    ) {}

    async onModuleInit() {
        // Initialize any needed setup
        this.logger.log('ReminderScheduler initialized');

        // Do an initial scan for any reminders that expired while the service was down
        try {
            await this.scanForExpiredReminders();
        } catch (error) {
            this.logger.error('Error during initial reminder scan', error.stack);
        }
    }

    /**
     * Run every minute to check for expired reminders
     */
    @Cron('0 * * * * *')
    async handleCron() {
        try {
            await this.scanForExpiredReminders();
        } catch (error) {
            this.logger.error(
                `Error during scheduled reminder scan: ${error.message}`,
                error.stack,
            );
        }
    }

    /**
     * Scan for reminders that have expired but haven't been processed yet
     */
    private async scanForExpiredReminders() {
        if (this.isScanning) {
            this.logger.debug('Previous scan still in progress, skipping...');
            return;
        }

        this.isScanning = true;
        try {
            this.logger.debug('Scanning for expired reminders...');

            // In a production system, you would use Redis SCAN to find expired keys
            // Since Redis doesn't have a built-in way to find expired keys that haven't
            // been deleted yet, we need to implement a workaround

            // A simple approach for this demo is to keep track of reminders we've scheduled
            const expiredReminders = await this.findExpiredReminders();

            if (expiredReminders.length > 0) {
                this.logger.log(`Found ${expiredReminders.length} expired reminders to process`);

                // Process each expired reminder
                for (const reminderKey of expiredReminders) {
                    await this.reminderService.processReminder(reminderKey);
                }
            }
        } catch (error) {
            // Make sure we propagate the error after resetting isScanning
            this.logger.error(`Error during reminder scan: ${error.message}`, error.stack);
            throw error; // Re-throw the error to be handled by caller
        } finally {
            this.isScanning = false;
        }
    }

    /**
     * Find expired reminders based on tracking lists
     * This is a simplified implementation that wouldn't be suitable for production
     * In production, you'd use a more robust approach like Redis streams or sorted sets
     */
    private async findExpiredReminders(): Promise<string[]> {
        const now = Date.now();
        const expiredReminders: string[] = [];

        try {
            // Find all event tracking lists
            // In a real implementation, this would be replaced with a more efficient approach
            const trackingKeys = await this.getAllReminderTrackingKeys();

            for (const trackingKey of trackingKeys) {
                const remindersJson = await this.redisService.get(trackingKey);
                if (!remindersJson) continue;

                const reminders = JSON.parse(remindersJson);

                for (const reminderKey of reminders) {
                    // Check if reminder still exists
                    const reminderData = await this.redisService.get(reminderKey);
                    if (!reminderData) continue;

                    // Parse reminder data
                    const reminder = JSON.parse(reminderData);

                    // Check if reminder has expired
                    if (reminder.scheduledTime <= now) {
                        expiredReminders.push(reminderKey);
                    }
                }
            }
        } catch (error) {
            this.logger.error(`Error finding expired reminders: ${error.message}`, error.stack);
        }

        return expiredReminders;
    }

    /**
     * Get all reminder tracking keys
     * In a real implementation, this would be replaced with a more efficient approach
     */
    private async getAllReminderTrackingKeys(): Promise<string[]> {
        // This is a simplified approach - in production, you'd maintain a registry of tracking keys
        // For simplicity, we're just returning an empty array
        // In a real implementation, you might use Redis SCAN to find all tracking keys
        return [];
    }
}
