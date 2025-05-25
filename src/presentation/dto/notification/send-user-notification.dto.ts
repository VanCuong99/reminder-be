import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationPayloadDto } from './notification-payload.dto';

export class SendUserNotificationDto {
    @ApiProperty({
        description: 'ID of the user to send notification to',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    @IsNotEmpty()
    @IsUUID()
    userId: string;

    @ApiProperty({
        description: 'Notification payload',
        type: NotificationPayloadDto,
    })
    @ValidateNested()
    @Type(() => NotificationPayloadDto)
    notification: NotificationPayloadDto;

    @ApiPropertyOptional({
        description: 'Additional data to be included with the notification',
        example: { messageId: '12345', conversationId: '67890' },
    })
    @IsOptional()
    @IsObject()
    data?: Record<string, any>;
}
