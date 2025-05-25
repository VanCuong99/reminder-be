import { EventCategory } from '../../../domain/entities/event.entity';

export interface EventFilterOptions {
    startDate?: string;
    endDate?: string;
    category?: EventCategory;
    timezone?: string;
}
