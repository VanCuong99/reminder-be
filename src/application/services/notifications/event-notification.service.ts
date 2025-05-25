import { Injectable } from '@nestjs/common';
import { NotificationService } from '../../../infrastructure/messaging/notification.service';
import { UserService } from '../users/user.service';
import { GuestDeviceService } from '../guest-device/guest-device.service';
import { Event } from '../../../domain/entities/event.entity';
import { User } from '../../../domain/entities/user.entity';

@Injectable()
export class EventNotificationService {
    private readonly DAYS_IN_MS = 86400000; // milliseconds in a day
    private readonly DEFAULT_EXPIRATION_DAYS = 30;

    constructor(
        private readonly notificationService: NotificationService,
        private readonly userService: UserService,
        private readonly guestDeviceService: GuestDeviceService,
    ) {}

    /**
     * Create event notification
     * @param event Event
     * @param sender User
     * @returns Promise<void>
     */ async createEventNotification(event: Event, sender: User): Promise<void> {
        try {
            // For now, we'll just use event's userId since it doesn't have participants property
            const userIds = event.userId ? [event.userId] : [];

            // Skip if no users or only the sender is involved
            if (!userIds.length || (userIds.length === 1 && userIds[0] === sender.id)) {
                return;
            }

            // Filter out sender from list of recipients
            const recipientIds = userIds.filter(id => id !== sender.id);

            if (recipientIds.length > 0) {
                // Use batch notification to send to multiple users at once
                await this.notificationService.sendNotificationToUsers(
                    recipientIds,
                    {
                        title: `New event: ${event.name}`,
                        body: `You have been invited to ${event.name} by ${sender.username || 'another user'}`,
                    },
                    {
                        type: 'event',
                        eventId: event.id,
                    },
                );
            }
        } catch (error) {
            throw new Error(`Error creating event notification: ${error}`);
        }
    }
    /**
     * Create guest event notification
     * @param event Event
     * @param deviceIds string[]
     * @returns Promise<void>
     */
    async createGuestEventNotification(event: Event, deviceIds: string[]): Promise<void> {
        try {
            // Use batch notification sending instead of one-by-one
            if (deviceIds.length === 0) {
                return;
            }

            // Get all devices in a batch
            const devices = await Promise.all(
                deviceIds.map(deviceId => this.guestDeviceService.findOrCreate(deviceId)),
            );

            // Filter for valid firebase tokens
            const tokensMap = new Map();
            devices.forEach(device => {
                if (device?.firebaseToken) {
                    tokensMap.set(device.deviceId, device.firebaseToken);
                }
            });

            if (tokensMap.size > 0) {
                // Convert to arrays for batch sending
                const tokens = Array.from(tokensMap.values());

                // Send to all tokens in one batch call using the batch notification method
                await this.notificationService.sendNotificationToBatch(
                    tokens,
                    `New event: ${event.name}`,
                    `You have been invited to ${event.name}`,
                    {
                        type: 'event',
                        eventId: event.id,
                    },
                );
            }
        } catch (error) {
            throw new Error(`Error creating guest event notification: ${error}`);
        }
    }

    /**
     * Create event update notification
     * @param event Event
     * @param sender User
     * @returns Promise<void>
     */
    async createEventUpdateNotification(event: Event, sender: User): Promise<void> {
        try {
            // For now, we'll just use event's userId since it doesn't have participants property
            const userIds = event.userId ? [event.userId] : [];

            // Skip if no users or only the sender is involved
            if (!userIds.length || (userIds.length === 1 && userIds[0] === sender.id)) {
                return;
            }

            // Filter out sender from list of recipients
            const recipientIds = userIds.filter(id => id !== sender.id);

            if (recipientIds.length > 0) {
                // Use batch notification to send to multiple users at once
                await this.notificationService.sendNotificationToUsers(
                    recipientIds,
                    {
                        title: `Event updated: ${event.name}`,
                        body: `${event.name} has been updated by ${sender.username || 'another user'}`,
                    },
                    {
                        type: 'event_update',
                        eventId: event.id,
                    },
                );
            }
        } catch (error) {
            throw new Error(`Error creating event update notification: ${error}`);
        }
    }
    /**
     * Create guest event update notification
     * @param event Event
     * @param deviceIds string[]
     * @returns Promise<void>
     */
    async createGuestEventUpdateNotification(event: Event, deviceIds: string[]): Promise<void> {
        try {
            // Use batch notification sending instead of one-by-one
            if (deviceIds.length === 0) {
                return;
            }

            // Get all devices in a batch
            const devices = await Promise.all(
                deviceIds.map(deviceId => this.guestDeviceService.findOrCreate(deviceId)),
            );

            // Filter for valid firebase tokens
            const tokensMap = new Map();
            devices.forEach(device => {
                if (device?.firebaseToken) {
                    tokensMap.set(device.deviceId, device.firebaseToken);
                }
            });

            if (tokensMap.size > 0) {
                // Convert to arrays for batch sending
                const tokens = Array.from(tokensMap.values());

                // Send to all tokens in one batch call
                await this.notificationService.sendNotificationToBatch(
                    tokens,
                    `Event updated: ${event.name}`,
                    `${event.name} has been updated`,
                    {
                        type: 'event_update',
                        eventId: event.id,
                    },
                );
            }
        } catch (error) {
            throw new Error(`Error creating guest event update notification: ${error}`);
        }
    }
}
