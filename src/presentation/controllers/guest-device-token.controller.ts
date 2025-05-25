import { Body, Controller, Post, Headers, Logger, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { GuestDeviceService } from '../../application/services/guest-device/guest-device.service';
import { RegisterGuestDeviceTokenDto } from '../dto/guest-device/register-guest-device-token.dto';
import { ApiResponseDto } from '../dto/common/responses/api-response.dto';
import { Response } from 'express';

@ApiTags('Guest Devices')
@Controller('guest-devices')
@ApiHeader({ name: 'X-Device-ID', description: 'Unique device identifier for guest users' })
export class GuestDeviceTokenController {
    private readonly logger = new Logger(GuestDeviceTokenController.name);

    constructor(private readonly guestDeviceService: GuestDeviceService) {}

    @ApiOperation({ summary: 'Register a Firebase token for a guest device' })
    @ApiResponse({
        status: 201,
        description: 'Device token registered successfully',
        type: ApiResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Invalid input' })
    @Post('register-token')
    async registerDeviceToken(
        @Headers('X-Device-ID') deviceId: string,
        @Headers() headers: Record<string, any>,
        @Body() registerDeviceTokenDto: RegisterGuestDeviceTokenDto,
        @Res({ passthrough: true }) response: Response,
    ) {
        try {
            // Delegate token registration to service
            const result = await this.guestDeviceService.registerDeviceToken(
                deviceId,
                headers,
                registerDeviceTokenDto.firebaseToken,
                registerDeviceTokenDto.timezone,
            );

            // Add the deviceId to the response headers if it was auto-generated
            if (result.needsDeviceId) {
                response.setHeader('X-Device-ID', result.deviceId);
            }

            return {
                success: true,
                message: 'Firebase token registered successfully',
                data: {
                    deviceId: result.guestDevice.deviceId,
                    registeredAt: new Date(),
                },
            };
        } catch (error) {
            this.logger.error(
                `Failed to register guest device token: ${error.message}`,
                error.stack,
            );
            throw error;
        }
    }
}
