import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsNotEmpty,
    IsString,
    IsOptional,
    IsEnum,
    IsBoolean,
    IsObject,
    ValidateNested,
    IsArray,
    IsNumber,
    IsISO8601,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EventCategory } from '../../../domain/entities/event.entity';

class NotificationSettingsDto {
    @ApiProperty({ description: 'Days before event to send reminders', type: [Number] })
    @IsArray()
    @IsNumber({}, { each: true })
    reminders: number[];

    @ApiProperty({ description: 'Whether notifications are enabled' })
    @IsBoolean()
    enabled: boolean;
}

export class CreateEventDto {
    @ApiProperty({
        description: 'Event name',
        example: 'Birthday Party',
    })
    @IsNotEmpty()
    @IsString()
    name: string;

    @ApiPropertyOptional({
        description: 'Event description',
        example: 'Annual birthday celebration with family and friends',
    })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({
        description: 'Event date (ISO string format)',
        example: '2025-06-15T18:00:00.000Z',
    })
    @IsISO8601()
    date: string;

    @ApiPropertyOptional({
        description: 'Event category',
        enum: EventCategory,
        default: EventCategory.OTHER,
    })
    @IsOptional()
    @IsEnum(EventCategory)
    category?: EventCategory;

    @ApiPropertyOptional({ description: 'Whether the event recurs', default: false })
    @IsOptional()
    @IsBoolean()
    isRecurring?: boolean;

    @ApiPropertyOptional({ description: 'Notification settings for the event' })
    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => NotificationSettingsDto)
    notificationSettings?: NotificationSettingsDto;

    @ApiPropertyOptional({ description: 'Timezone for the event' })
    @IsOptional()
    @IsString()
    timezone?: string;

    @ApiPropertyOptional({
        description:
            'Firebase Cloud Messaging (FCM) token for push notifications. ' +
            'For authenticated users, this token is registered with the user account. ' +
            'For guest users, this token is associated with the deviceId. ' +
            'Provide this token to receive push notifications for event reminders and updates.',
    })
    @IsOptional()
    @IsString()
    firebaseToken?: string;

    @ApiPropertyOptional({
        description:
            'ID of the device creating this event. ' +
            'This is stored for both authenticated and guest users to track which device created the event.',
    })
    @IsOptional()
    @IsString()
    sourceDeviceId?: string;

    @ApiPropertyOptional({
        description:
            'Device ID for tracking notifications and device-specific functionality. ' +
            'For authenticated users, this helps link the event to specific devices for notifications. ' +
            'For guest users, this identifies which device owns the event.',
    })
    @IsOptional()
    @IsString()
    deviceId?: string;
}
