import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class RegisterDeviceDto {
    @ApiProperty({
        description: 'Firebase Cloud Messaging (FCM) token for push notifications',
        example: 'firebase:token_example_string_here',
    })
    @IsNotEmpty()
    @IsString()
    firebaseToken: string;

    @ApiPropertyOptional({
        description: 'Timezone for the device',
        example: 'America/New_York',
    })
    @IsOptional()
    @IsString()
    timezone?: string;
}
