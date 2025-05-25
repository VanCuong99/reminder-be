import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class NotificationPayloadDto {
    @ApiProperty({
        description: 'Title of the notification',
        example: 'New Message',
    })
    @IsNotEmpty()
    @IsString()
    title: string;

    @ApiProperty({
        description: 'Body of the notification',
        example: 'You have received a new message from John.',
    })
    @IsNotEmpty()
    @IsString()
    body: string;

    @ApiPropertyOptional({
        description: 'Additional data to send with the notification',
        example: { messageId: '12345', senderId: '54321', type: 'chat' },
    })
    @IsOptional()
    @IsObject()
    data?: Record<string, any>;
}
