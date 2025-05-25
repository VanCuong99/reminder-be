import {
    Controller,
    Get,
    Post,
    Param,
    Headers,
    Query,
    Logger,
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';
import { NotificationService } from '../../infrastructure/messaging/notification.service';
import { NotificationResult } from '../../infrastructure/messaging/notification-result.interface';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { DeviceFingerprintingService } from '../../shared/services/device-fingerprinting.service';

@ApiTags('guest-notifications')
@Controller('guest-notifications')
@ApiHeader({ name: 'X-Device-ID', description: 'Unique device identifier for guest users' })
export class GuestNotificationController {
    private readonly logger = new Logger(GuestNotificationController.name);

    constructor(
        private readonly notificationService: NotificationService,
        private readonly deviceFingerprintingService: DeviceFingerprintingService,
    ) {}

    @Get()
    @ApiOperation({ summary: 'Get all notifications for a guest device' })
    @ApiResponse({ status: 200, description: 'Return guest notifications' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    async getNotifications(
        @Headers('X-Device-ID') deviceId: string,
        @Headers() headers: Record<string, any>,
        @Query('page') page?: number,
        @Query('limit') limit?: number,
        @Query('status') status?: string,
    ) {
        // Ensure we have a device ID, generating one if needed
        const { deviceId: ensuredDeviceId } = this.deviceFingerprintingService.ensureDeviceId(
            deviceId,
            headers,
        );

        // Update the deviceId with the ensured value
        deviceId = ensuredDeviceId;

        try {
            return await this.notificationService.getGuestNotifications(deviceId, {
                page: page || 1,
                limit: limit || 20,
                status,
            });
        } catch (error) {
            this.logger.error(`Failed to get guest notifications: ${error.message}`, error.stack);
            throw error;
        }
    }

    @Post(':id/read')
    @ApiOperation({ summary: 'Mark a notification as read for a guest device' })
    @ApiResponse({ status: 200, description: 'Notification marked as read' })
    @ApiResponse({ status: 404, description: 'Notification not found' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    async markAsRead(
        @Headers('X-Device-ID') deviceId: string,
        @Headers() headers: Record<string, any>,
        @Param('id') notificationId: string,
    ) {
        // Auto-generate deviceId if not provided
        if (!deviceId) {
            const userAgent = headers['user-agent'] ?? 'unknown-agent';
            const clientIp = headers['x-forwarded-for'] ?? 'unknown-ip';

            // Use the DeviceFingerprintingService to generate a device ID
            deviceId = this.deviceFingerprintingService.generateFingerprint(userAgent, clientIp);
            this.logger.debug(
                `Auto-generated device ID for marking notification as read: ${deviceId}`,
            );
        }

        try {
            const result = await this.notificationService.markGuestNotificationAsRead(
                deviceId,
                notificationId,
            );

            if (!result) {
                throw new NotFoundException(`Notification with ID ${notificationId} not found`);
            }

            return result;
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            this.logger.error(`Failed to mark notification as read: ${error.message}`, error.stack);
            throw new BadRequestException(error.message);
        }
    }

    @Post('test-notification')
    @ApiOperation({ summary: 'Send a test notification to a guest device' })
    @ApiResponse({ status: 200, description: 'Test notification sent' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 404, description: 'Guest device not found' })
    async sendTestNotification(
        @Headers('X-Device-ID') deviceId: string,
        @Headers() headers: Record<string, any>,
    ): Promise<NotificationResult> {
        // Auto-generate deviceId if not provided
        if (!deviceId) {
            const userAgent = headers['user-agent'] ?? 'unknown-agent';
            const clientIp = headers['x-forwarded-for'] ?? 'unknown-ip';

            // Use the DeviceFingerprintingService to generate a device ID
            deviceId = this.deviceFingerprintingService.generateFingerprint(userAgent, clientIp);
            this.logger.debug(`Auto-generated device ID: ${deviceId}`);
        }

        try {
            // Send a test notification to the guest device
            return await this.notificationService.sendNotificationToDevice(
                deviceId,
                'Test Notification',
                'This is a test notification for your guest account',
                {
                    type: 'test',
                    timestamp: new Date().toISOString(),
                },
            );
        } catch (error) {
            this.logger.error(`Failed to send test notification: ${error.message}`, error.stack);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    @Get('status')
    @ApiOperation({ summary: 'Check the notification status for a guest device' })
    @ApiResponse({ status: 200, description: 'Notification status information' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    async getNotificationStatus(
        @Headers('X-Device-ID') deviceId: string,
        @Headers() headers: Record<string, any>,
    ) {
        // Auto-generate deviceId if not provided
        if (!deviceId) {
            const userAgent = headers['user-agent'] ?? 'unknown-agent';
            const clientIp = headers['x-forwarded-for'] ?? 'unknown-ip';

            // Use the DeviceFingerprintingService to generate a device ID
            deviceId = this.deviceFingerprintingService.generateFingerprint(userAgent, clientIp);
            this.logger.debug(
                `Auto-generated device ID for notification status check: ${deviceId}`,
            );
        }

        try {
            const firestore = this.notificationService['firebaseService']?.getFirestore();
            if (!firestore) {
                throw new BadRequestException('Firebase not properly initialized');
            }

            // Check if the guest device exists in Firestore
            const guestDevicePath = `guest_devices/${deviceId}`;
            const guestDocRef = firestore.doc(guestDevicePath);
            const guestDoc = await guestDocRef.get();

            // Get the notification collection reference
            const notificationsRef = firestore
                .collection('guest_devices')
                .doc(deviceId)
                .collection('notifications');

            // Attempt to get notifications (even if none exist, this confirms the structure is correct)
            const notificationSnapshot = await notificationsRef.limit(1).get();

            return {
                success: true,
                deviceExists: guestDoc.exists,
                devicePath: guestDevicePath,
                notificationsPath: `${guestDevicePath}/notifications`,
                collectionExists: true,
                sampleNotificationCount: notificationSnapshot.docs.length,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error(`Failed to get notification status: ${error.message}`, error.stack);

            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString(),
            };
        }
    }
}
