import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { FirebaseService } from '../../../infrastructure/firestore/firebase.service';
import { NotificationService } from '../../../infrastructure/messaging/notification.service';
import { Event } from '../../../domain/entities/event.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
    HOURS_PER_DAY,
    SECONDS_PER_MINUTE,
    MINUTES_PER_HOUR,
    MILLISECONDS_PER_DAY,
} from '../../../shared/constants/constants';

@Injectable()
export class ReminderService {
    private readonly logger = new Logger(ReminderService.name);
    private readonly reminderPrefix = 'event:reminder:';
    private readonly trackingPrefix = 'event:tracking:';
    private readonly reminderExpiration =
        SECONDS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY * 365; // 1 year in seconds

    constructor(
        private readonly redisService: RedisService,
        private readonly firebaseService: FirebaseService,
        private readonly notificationService: NotificationService,
        @InjectRepository(Event)
        private readonly eventRepository: Repository<Event>,
    ) {}

    /**
     * Schedule reminders for an event
     */
    async scheduleEventReminders(event: Event): Promise<void> {
        try {
            if (!event?.date) {
                return;
            }

            // First, remove any existing reminders for this event
            await this.removeEventReminders(event.id);

            // Get reminder settings - default to a reminder at event time
            const reminderSettings = event.notificationSettings?.reminders || [0];
            const isEnabled = event.notificationSettings?.enabled !== false; // Enabled by default

            if (!isEnabled) {
                this.logger.log(`Reminders disabled for event ${event.id}`);
                return;
            }

            // Create tracking list for this event
            const trackingKey = `${this.trackingPrefix}${event.id}`;
            const reminderKeys: string[] = [];

            // Schedule reminder for the event time
            const eventTime = new Date(event.date).getTime();

            // Add reminders based on settings
            // Create batch of commands for Redis
            const commands = [];

            // Process each reminder setting
            for (const daysBeforeEvent of reminderSettings) {
                // Calculate when to trigger reminder
                const daysInMs = daysBeforeEvent * MILLISECONDS_PER_DAY;
                const reminderTime = eventTime - daysInMs;

                // Skip if reminder time is in the past
                if (reminderTime <= Date.now()) {
                    continue;
                }

                // Create unique reminder key
                const reminderKey = `${this.reminderPrefix}${event.id}:${daysBeforeEvent}`;

                // Store reminder data
                const reminderData = {
                    eventId: event.id,
                    userId: event.userId,
                    deviceId: event.deviceId,
                    eventName: event.name,
                    eventDate: event.date.toISOString(),
                    scheduledTime: reminderTime,
                    daysBeforeEvent: daysBeforeEvent,
                    createdAt: Date.now(),
                };

                // Prepare command for batch operation
                const ttl = Math.ceil((reminderTime - Date.now()) / 1000);
                commands.push(['set', reminderKey, JSON.stringify(reminderData), 'EX', ttl]);

                this.logger.debug(
                    `Prepared reminder for event ${event.id} on ${new Date(reminderTime).toISOString()}`,
                );

                // Add to tracking list
                reminderKeys.push(reminderKey);
            }

            // Store tracking list if there are any reminders
            if (reminderKeys.length > 0) {
                // Add the tracking key to the commands
                commands.push([
                    'set',
                    trackingKey,
                    JSON.stringify(reminderKeys),
                    'EX',
                    this.reminderExpiration,
                ]);

                // Execute all commands in one transaction for better performance
                if (commands.length > 0) {
                    await this.redisService.executeTransaction(commands);
                    this.logger.debug(
                        `Scheduled ${reminderKeys.length} reminders for event ${event.id} in batch`,
                    );
                }
            }
        } catch (error) {
            this.logger.error(
                `Failed to schedule reminders for event ${event?.id}: ${error.message}`,
                error.stack,
            );
        }
    }

    /**
     * Update reminders for an event
     */
    async updateEventReminders(event: Event): Promise<void> {
        try {
            // Just reschedule all reminders
            return await this.scheduleEventReminders(event);
        } catch (error) {
            this.logger.error(
                `Failed to schedule reminders for event ${event?.id}: ${error.message}`,
                error.stack,
            );
        }
    }

    /**
     * Remove all reminders for an event
     */
    async removeEventReminders(eventId: string): Promise<void> {
        try {
            // Get tracking key for this event
            const trackingKey = `${this.trackingPrefix}${eventId}`;

            // Get list of reminder keys
            const reminderKeysJson = await this.redisService.get(trackingKey);

            if (reminderKeysJson) {
                const reminderKeys = JSON.parse(reminderKeysJson);

                // Use Redis transaction to delete all reminders in one batch operation
                if (reminderKeys.length > 0) {
                    const commands = [];

                    // Add commands to delete each reminder
                    for (const key of reminderKeys) {
                        commands.push(['del', key]);
                    }

                    // Also delete the tracking key
                    commands.push(['del', trackingKey]);

                    // Execute all delete commands in a single batch operation
                    await this.redisService.executeTransaction(commands);
                }

                this.logger.debug(`Removed ${reminderKeys.length} reminders for event ${eventId}`);
            }
        } catch (error) {
            this.logger.error(
                `Failed to remove reminders for event ${eventId}: ${error.message}`,
                error.stack,
            );
        }
    }

    /**
     * Process a reminder when it expires
     */
    async processReminder(reminderKey: string): Promise<void> {
        try {
            // Get reminder data
            const reminderDataJson = await this.redisService.get(reminderKey);

            if (!reminderDataJson) {
                this.logger.debug(`Reminder ${reminderKey} already processed or expired`);
                return;
            }

            const reminderData = JSON.parse(reminderDataJson);
            const { eventId, userId, deviceId, eventName, daysBeforeEvent } = reminderData;

            // Check if event still exists and is active
            const event = await this.eventRepository.findOne({
                where: { id: eventId },
            });

            if (!event) {
                this.logger.debug(`Event ${eventId} no longer exists, skipping reminder`);
                await this.redisService.delete(reminderKey);
                return;
            }

            // Prepare notification content
            const isEventDay = daysBeforeEvent === 0;
            const title = isEventDay
                ? `Event happening now: ${eventName}`
                : `Upcoming event: ${eventName}`;

            const body = isEventDay
                ? `Your event "${eventName}" is happening now!`
                : `Your event "${eventName}" is happening in ${daysBeforeEvent} day(s).`;

            // Send notification to the appropriate user
            if (userId) {
                // For authenticated users
                await this.notificationService.sendNotificationToUser(
                    userId,
                    { title, body },
                    { eventId, type: 'reminder', daysBeforeEvent: daysBeforeEvent.toString() },
                );
                this.logger.log(
                    `Sent reminder notification to user ${userId} for event ${eventId}`,
                );
            } else if (deviceId) {
                // For guest users
                await this.notificationService.sendNotificationToDevice(deviceId, title, body, {
                    eventId,
                    type: 'reminder',
                    daysBeforeEvent: daysBeforeEvent.toString(),
                });
                this.logger.log(
                    `Sent reminder notification to device ${deviceId} for event ${eventId}`,
                );
            } else {
                this.logger.warn(`No user or device ID found for reminder ${reminderKey}`);
            }

            // Delete the reminder after processing
            await this.redisService.delete(reminderKey);
        } catch (error) {
            this.logger.error(
                `Failed to process reminder ${reminderKey}: ${error.message}`,
                error.stack,
            );
        }
    }
}
