import { ApiProperty } from '@nestjs/swagger';
import { EventCategory } from '../../../domain/entities/event.entity';

export class EventResponseDto {
    @ApiProperty({ description: 'Unique identifier of the event' })
    id: string;

    @ApiProperty({ description: 'Name of the event' })
    name: string;

    @ApiProperty({ description: 'Description of the event', required: false })
    description?: string;

    @ApiProperty({ description: 'Date of the event' })
    date: string;

    @ApiProperty({ description: 'Category of the event', enum: EventCategory })
    category: EventCategory;

    @ApiProperty({ description: 'Whether the event is recurring' })
    isRecurring: boolean;

    @ApiProperty({ description: 'Device ID associated with the event' })
    deviceId: string;

    @ApiProperty({ description: 'Timezone of the event', required: false })
    timezone?: string;

    @ApiProperty({ description: 'Notification settings for the event', required: false })
    notificationSettings?: {
        reminders: number[];
        enabled: boolean;
    };
}
