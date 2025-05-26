import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { FirebaseService } from '../../../infrastructure/firestore/firebase.service';
import { toZonedTime } from 'date-fns-tz';
import { Event } from '../../../domain/entities/event.entity';
import { GuestDeviceService } from '../guest-device/guest-device.service';
import { ReminderService } from '../notifications/reminder.service';
import { DeviceTokenService } from '../device-token/device-token.service';
import { NotificationService } from '../../../infrastructure/messaging/notification.service';
import { EventNotificationService } from '../notifications/event-notification.service';
import { TimezoneService } from '../../../shared/services/timezone.service';
import { EventEnrichmentService } from '../../../shared/services/event-enrichment.service';

// Import the interfaces from separate files
import { EventCreationDto } from '../../interfaces/events/event-creation.interface';
import { EventFilterOptions } from '../../interfaces/events/event-filter-options.interface';

@Injectable()
export class EventService {
    private readonly logger = new Logger(EventService.name);

    constructor(
        private readonly firebaseService: FirebaseService,
        @InjectRepository(Event)
        private readonly eventRepository: Repository<Event>,
        private readonly guestDeviceService: GuestDeviceService,
        private readonly reminderService: ReminderService,
        private readonly dataSource: DataSource,
        private readonly timezoneService: TimezoneService,
        private readonly deviceTokenService: DeviceTokenService,
        private readonly notificationService: NotificationService,
        private readonly eventNotificationService: EventNotificationService,
        private readonly eventEnrichmentService: EventEnrichmentService,
    ) {}

    /**
     * Create a new event for an authenticated user
     */
    async createEventForUser(userId: string, eventData: EventCreationDto): Promise<Event> {
        try {
            // Enrich event data for authenticated user
            this.eventEnrichmentService.enrichAuthenticatedEventData(eventData);

            const event = this.eventRepository.create({
                ...eventData,
                userId,
                // Keep sourceDeviceId from eventData if it exists
                sourceDeviceId: eventData.sourceDeviceId,
                // Ensure deviceId is null to avoid foreign key constraint
                deviceId: null,
            });

            // Process date with timezone - always use timezone for proper date handling
            if (eventData.date) {
                // Ensure we have a valid timezone
                event.timezone = this.timezoneService.isValidTimezone(eventData.timezone)
                    ? eventData.timezone
                    : this.timezoneService.DEFAULT_TIMEZONE;

                // Log the timezone being used
                this.logger.debug(
                    `Creating authenticated user event with timezone: ${event.timezone}`,
                );

                // Convert to UTC for storage using date-fns-tz
                // This ensures consistent date handling regardless of the server's timezone
                const zonedDate = toZonedTime(new Date(eventData.date), event.timezone);
                event.date = zonedDate;
            }

            const savedEvent = await this.eventRepository.save(event);

            // Schedule reminders for the event
            await this.reminderService.scheduleEventReminders(savedEvent);

            // Create notification through the EventNotificationService
            // Create a minimal user object with required id
            const sender = { id: userId, name: 'User' } as any;
            await this.eventNotificationService.createEventNotification(savedEvent, sender);

            return savedEvent;
        } catch (error) {
            this.logger.error(`Failed to create event for user: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Create a new event for a guest user
     * This method ensures:
     * 1. A valid deviceId is always set (from header, not from DTO)
     * 2. A valid timezone is always set (from header detection or default)
     */
    async createEventForGuest(deviceId: string, eventData: EventCreationDto): Promise<Event> {
        try {
            // Enrich event data for guest user
            this.eventEnrichmentService.enrichGuestEventData(eventData, deviceId, null);

            // Find or create guest device with firebase token
            await this.guestDeviceService.findOrCreate(
                deviceId,
                eventData.firebaseToken,
                eventData.timezone,
            );

            const event = this.eventRepository.create({
                ...eventData,
                deviceId, // Explicitly set deviceId from header
                // Keep sourceDeviceId from eventData if it exists or use deviceId as sourceDeviceId
                sourceDeviceId: eventData.sourceDeviceId || deviceId,
            });

            // Process date with timezone - always use timezone for proper date handling
            if (eventData.date) {
                // Ensure we have a valid timezone
                event.timezone = this.timezoneService.isValidTimezone(eventData.timezone)
                    ? eventData.timezone
                    : this.timezoneService.DEFAULT_TIMEZONE;

                // Log the timezone being used
                this.logger.debug(`Creating guest user event with timezone: ${event.timezone}`);

                // Convert to UTC for storage using date-fns-tz
                // This ensures consistent date handling regardless of the server's timezone
                const zonedDate = toZonedTime(new Date(eventData.date), event.timezone);
                event.date = zonedDate;
            }

            const savedEvent = await this.eventRepository.save(event);

            // Schedule reminders for the event
            await this.reminderService.scheduleEventReminders(savedEvent);

            // Create notification for the guest event using EventNotificationService
            await this.eventNotificationService.createGuestEventNotification(savedEvent, [
                deviceId,
            ]);

            return savedEvent;
        } catch (error) {
            this.logger.error(`Failed to create event for guest: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Update an event for a guest user
     */
    async updateEventForGuest(
        deviceId: string,
        eventId: string,
        eventData: EventCreationDto,
    ): Promise<Event> {
        try {
            const event = await this.eventRepository.findOne({
                where: { id: eventId, deviceId },
            });

            if (!event) {
                throw new NotFoundException(`Event with ID ${eventId} not found for this device`);
            }

            // Enrich event data for guest user
            this.eventEnrichmentService.enrichGuestEventData(eventData, deviceId, null);

            // Update event properties
            Object.assign(event, eventData);

            // Process date with timezone if provided
            if (eventData.date && event.timezone) {
                // Convert to UTC for storage
                const zonedDate = toZonedTime(new Date(eventData.date), event.timezone);
                event.date = zonedDate;
            }

            const updatedEvent = await this.eventRepository.save(event);

            // Run these operations in parallel for better performance
            await Promise.all([
                // Update reminders for the event
                this.reminderService.updateEventReminders(updatedEvent),

                // Create notification for the guest event update using EventNotificationService with batch processing
                this.eventNotificationService.createGuestEventUpdateNotification(updatedEvent, [
                    deviceId,
                ]),
            ]);

            return updatedEvent;
        } catch (error) {
            this.logger.error(`Failed to update event for guest: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Update an event
     * Only authenticated users can update events
     */
    async updateEvent(
        userId: string,
        eventId: string,
        eventData: EventCreationDto,
    ): Promise<Event> {
        try {
            const event = await this.eventRepository.findOne({
                where: { id: eventId, userId },
            });

            if (!event) {
                throw new NotFoundException(`Event with ID ${eventId} not found`);
            }

            // Enrich event data for authenticated user
            this.eventEnrichmentService.enrichAuthenticatedEventData(eventData, event);

            // Update event properties
            Object.assign(event, eventData);

            // Handle timezone fallback if invalid timezone is provided
            if (eventData.timezone && !this.timezoneService.isValidTimezone(eventData.timezone)) {
                this.logger.warn(
                    `Invalid timezone provided: ${eventData.timezone}. Falling back to event's existing timezone: ${event.timezone}`,
                );
                event.timezone = event.timezone || this.timezoneService.DEFAULT_TIMEZONE;
            }

            // Process date with timezone if provided
            if (eventData.date && event.timezone) {
                // Convert to UTC for storage
                const zonedDate = toZonedTime(new Date(eventData.date), event.timezone);
                event.date = zonedDate;
            }

            const updatedEvent = await this.eventRepository.save(event);

            // Create sender object for notifications
            const sender = { id: userId, name: 'User' } as any;

            // Run these operations in parallel for better performance
            await Promise.all([
                // Update reminders for the event
                this.reminderService.updateEventReminders(updatedEvent),

                // Create update notification through EventNotificationService
                this.eventNotificationService.createEventUpdateNotification(updatedEvent, sender),
            ]);

            return updatedEvent;
        } catch (error) {
            this.logger.error(`Failed to update event: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Get event by ID
     * Works for both authenticated and guest users
     */
    async getEventById(
        identityInfo: { userId?: string; deviceId?: string },
        eventId: string,
    ): Promise<Event> {
        try {
            let event: Event | null = null;

            if (identityInfo.userId) {
                // Get event for authenticated user
                event = await this.eventRepository.findOne({
                    where: { id: eventId, userId: identityInfo.userId },
                });
            } else if (identityInfo.deviceId) {
                // Get event for guest user
                event = await this.eventRepository.findOne({
                    where: { id: eventId, deviceId: identityInfo.deviceId },
                });
            } else {
                throw new BadRequestException('Either userId or deviceId must be provided');
            }

            if (!event) {
                throw new NotFoundException(`Event with ID ${eventId} not found`);
            }

            return event;
        } catch (error) {
            this.logger.error(`Failed to get event by ID: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Get events for a user or guest
     */
    async getEvents(
        identityInfo: { userId?: string; deviceId?: string },
        options: EventFilterOptions = {},
    ): Promise<Event[]> {
        try {
            let events: Event[] = [];

            if (identityInfo.userId) {
                // Get events for authenticated user
                events = await this.eventRepository.find({
                    where: { userId: identityInfo.userId },
                    order: { date: 'ASC' },
                });
            } else if (identityInfo.deviceId) {
                // Get events for guest user
                events = await this.eventRepository.find({
                    where: { deviceId: identityInfo.deviceId },
                    order: { date: 'ASC' },
                });
            } else {
                throw new BadRequestException('Either userId or deviceId must be provided');
            }

            return events;
        } catch (error) {
            this.logger.error(`Failed to get events: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Delete an event
     * Only authenticated users can delete events
     */
    async deleteEvent(userId: string, eventId: string): Promise<void> {
        try {
            const event = await this.eventRepository.findOne({
                where: { id: eventId, userId },
            });

            if (!event) {
                throw new NotFoundException(`Event with ID ${eventId} not found`);
            }

            // Remove scheduled reminders first
            await this.reminderService.removeEventReminders(eventId);

            // Delete the event
            await this.eventRepository.remove(event);
        } catch (error) {
            this.logger.error(`Failed to delete event: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Migrate guest events to a user account
     * Used when a guest registers as an authenticated user
     */
    async migrateGuestEvents(userId: string, deviceId: string): Promise<number> {
        const queryRunner = this.dataSource.createQueryRunner();

        try {
            // Start a transaction
            await queryRunner.connect();
            await queryRunner.startTransaction();

            // Find all events for the specified device ID
            const events = await queryRunner.manager.find(Event, {
                where: { deviceId },
            });

            if (!events.length) {
                return 0;
            }

            // Update all events to belong to the user
            for (const event of events) {
                event.userId = userId;
                // Keep the deviceId for tracking which device created the event
            }

            // Save all events in a batch
            await queryRunner.manager.save(events);

            // Commit the transaction
            await queryRunner.commitTransaction();

            // Batch update reminders for all migrated events
            // This is more efficient than sending individual requests
            await Promise.all(
                events.map(event => this.reminderService.updateEventReminders(event)),
            );

            this.logger.log(
                `Migrated ${events.length} events from device ${deviceId} to user ${userId}`,
            );

            return events.length;
        } catch (error) {
            // Rollback transaction on error
            await queryRunner.rollbackTransaction();
            this.logger.error(`Failed to migrate guest events: ${error.message}`, error.stack);
            throw error;
        } finally {
            // Release the query runner
            await queryRunner.release();
        }
    }

    // Controller compatibility methods

    /**
     * Create event for either authenticated user or guest
     */
    async create(
        identityInfo: { userId?: string; deviceId?: string },
        createEventDto: EventCreationDto,
    ): Promise<Event> {
        if (identityInfo.userId) {
            return this.createEventForUser(identityInfo.userId, createEventDto);
        } else if (identityInfo.deviceId) {
            return this.createEventForGuest(identityInfo.deviceId, createEventDto);
        } else {
            throw new BadRequestException('Either userId or deviceId must be provided');
        }
    }

    /**
     * Find all events for authenticated user or guest
     */
    async findAll(
        identityInfo: { userId?: string; deviceId?: string },
        options: EventFilterOptions = {},
    ): Promise<Event[]> {
        return this.getEvents(identityInfo, options);
    }

    /**
     * Find one event for authenticated user or guest
     */
    async findOne(
        identityInfo: { userId?: string; deviceId?: string },
        id: string,
    ): Promise<Event> {
        return this.getEventById(identityInfo, id);
    }

    /**
     * Update event for either authenticated user or guest
     */
    async update(
        identityInfo: { userId?: string; deviceId?: string },
        id: string,
        updateEventDto: EventCreationDto,
    ): Promise<Event> {
        if (identityInfo.userId) {
            return this.updateEvent(identityInfo.userId, id, updateEventDto);
        } else if (identityInfo.deviceId) {
            return this.updateEventForGuest(identityInfo.deviceId, id, updateEventDto);
        } else {
            throw new BadRequestException('Either userId or deviceId must be provided');
        }
    }

    /**
     * Delete event (authenticated users only)
     */
    async remove(identityInfo: { userId?: string; deviceId?: string }, id: string): Promise<void> {
        if (identityInfo.userId) {
            return this.deleteEvent(identityInfo.userId, id);
        } else {
            throw new BadRequestException('Authentication required to delete events');
        }
    }
}
