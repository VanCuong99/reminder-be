import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class RegisterGuestDeviceTokenDto {
    @ApiProperty({
        description: 'Firebase Cloud Messaging registration token for the guest device',
        example: 'dFKmSQtiQ8CnVl27Mp4j9o:APA91bFrJjGPM7cX_J5MhcNTtfRZg3fBl2N8PiVR1EwA7ivE_yGz5OpNQ',
    })
    @IsString()
    @IsNotEmpty()
    firebaseToken: string;

    @ApiProperty({
        description: 'Device timezone in IANA format',
        example: 'Asia/Ho_Chi_Minh',
        required: false,
    })
    @IsString()
    @IsOptional()
    timezone?: string;
}
