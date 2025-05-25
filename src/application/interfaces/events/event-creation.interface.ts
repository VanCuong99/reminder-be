import { EventCategory } from '../../../domain/entities/event.entity';

// Instead of extending Partial<Event>, define the interface with the same properties
export interface EventCreationDto {
    id?: string;
    name?: string;
    description?: string;
    date?: string | Date; // Support both string and Date objects
    category?: EventCategory;
    isRecurring?: boolean;
    notificationSettings?: {
        reminders: number[];
        enabled: boolean;
    };
    userId?: string;
    deviceId?: string;
    sourceDeviceId?: string;
    timezone?: string;
    isActive?: boolean;
    firebaseToken?: string;
}
