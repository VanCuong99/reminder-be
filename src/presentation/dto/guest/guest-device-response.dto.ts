import { ApiProperty } from '@nestjs/swagger';

export class GuestDeviceResponseDto {
    @ApiProperty({ description: 'Unique identifier of the guest device' })
    id: string;

    @ApiProperty({ description: 'Device identifier for the guest user' })
    deviceId: string;

    @ApiProperty({ description: 'Firebase Cloud Messaging token' })
    firebaseToken: string;

    @ApiProperty({ description: 'Timezone for the device', required: false })
    timezone?: string;

    @ApiProperty({ description: 'When the device was created' })
    createdAt: Date;

    @ApiProperty({ description: 'When the device was last updated' })
    updatedAt: Date;
}
