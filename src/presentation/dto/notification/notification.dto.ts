import { IsNotEmpty, IsString, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationDto {
    @ApiProperty({ description: 'Notification title', example: 'New message' })
    @IsNotEmpty()
    @IsString()
    title: string;

    @ApiProperty({ description: 'Notification body', example: 'You have received a new message' })
    @IsNotEmpty()
    @IsString()
    body: string;

    @ApiPropertyOptional({
        description: 'Additional notification data',
        example: { messageId: '123', senderId: '456' },
    })
    @IsOptional()
    @IsObject()
    data?: Record<string, any>;
}
