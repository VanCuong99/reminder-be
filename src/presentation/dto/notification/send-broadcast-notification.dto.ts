import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationPayloadDto } from './notification-payload.dto';

export class SendBroadcastNotificationDto {
    @ApiProperty({
        description: 'Notification payload',
        type: NotificationPayloadDto,
    })
    @ValidateNested()
    @Type(() => NotificationPayloadDto)
    notification: NotificationPayloadDto;

    @ApiPropertyOptional({
        description: 'Additional data to be included with the notification',
        example: { eventId: '12345', eventType: 'system_announcement' },
    })
    @IsOptional()
    @IsObject()
    data?: Record<string, any>;
}
