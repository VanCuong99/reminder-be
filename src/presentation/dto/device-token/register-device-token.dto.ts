import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum DeviceType {
    ANDROID = 'ANDROID',
    IOS = 'IOS',
    WEB = 'WEB',
    OTHER = 'OTHER',
}

export class RegisterDeviceTokenDto {
    @ApiProperty({
        description: 'Device token for push notifications',
        example: 'c3Vwc3VwZXJzZWNyZXR0b2tlbmZvcnB1c2hub3RpZmljYXRpb25z',
    })
    @IsNotEmpty()
    @IsString()
    token: string;

    @ApiPropertyOptional({
        description: 'Type of device',
        enum: DeviceType,
        default: DeviceType.OTHER,
    })
    @IsOptional()
    @IsEnum(DeviceType)
    deviceType?: DeviceType = DeviceType.OTHER;
}
