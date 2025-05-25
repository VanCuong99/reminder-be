import { Injectable, Logger } from '@nestjs/common';
import { TimezoneService } from './timezone.service';
import { DeviceDetectionService } from './device-detection.service';
import { DeviceFingerprintingService } from './device-fingerprinting.service';
import { DeviceTokenService } from '../../application/services/device-token/device-token.service';
import { HTTP_HEADERS } from '../constants/http-headers';

@Injectable()
export class EventEnrichmentService {
    private readonly logger = new Logger(EventEnrichmentService.name);

    constructor(
        private readonly timezoneService: TimezoneService,
        private readonly deviceDetectionService: DeviceDetectionService,
        private readonly deviceFingerprintingService: DeviceFingerprintingService,
        private readonly deviceTokenService: DeviceTokenService,
    ) {}

    /**
     * Enrich event data with device and timezone information for a guest user
     * @param eventDto The event data to enrich
     * @param deviceId The device ID to associate with the event
     * @param headers Request headers for timezone detection
     */
    async enrichGuestEventData(
        eventDto: any,
        deviceId: string,
        headers: Record<string, any>,
    ): Promise<void> {
        // Always use the deviceId from the header, not the DTO, for security
        if (eventDto.deviceId !== deviceId) {
            this.logger.warn(
                `DeviceId mismatch: header (${deviceId}) doesn't match DTO (${eventDto.deviceId}). Using header value.`,
            );
        }
        // Force the deviceId to be the one from the header
        eventDto.deviceId = deviceId;

        // For guest events, make sure sourceDeviceId is assigned if not provided
        if (!eventDto.sourceDeviceId) {
            eventDto.sourceDeviceId = deviceId;
            this.logger.debug(
                `No sourceDeviceId provided, using deviceId from header: ${deviceId}`,
            );
        }

        this.enrichEventTimezone(eventDto, headers);
    }

    /**
     * Enrich event data with timezone and device information for an authenticated user
     * @param eventDto The event data to enrich
     * @param currentEvent Optional current event data for updates
     * @param headers Request headers for timezone detection
     */ async enrichAuthenticatedEventData(
        eventDto: any,
        user?: any,
        headers?: Record<string, any>,
        currentEvent?: any,
    ): Promise<void> {
        // For authenticated users, ensure deviceId is null to avoid FK constraint
        eventDto.deviceId = null; // Handle sourceDeviceId
        if (currentEvent?.sourceDeviceId && !eventDto.sourceDeviceId) {
            // Keep the current sourceDeviceId if updating and no new one provided
            eventDto.sourceDeviceId = currentEvent.sourceDeviceId;
        } else if (!eventDto.sourceDeviceId && headers) {
            // Generate new sourceDeviceId if not provided and we have headers
            const userAgent = headers[HTTP_HEADERS.USER_AGENT] ?? '';
            const clientIp =
                headers[HTTP_HEADERS.X_FORWARDED_FOR] ??
                headers[HTTP_HEADERS.CONNECTION]?.remoteAddress ??
                'unknown';
            const sourceDeviceId = this.deviceFingerprintingService.generateFingerprint(
                userAgent,
                clientIp,
            );
            eventDto.sourceDeviceId = sourceDeviceId;
            this.logger.debug(`Generated sourceDeviceId: ${sourceDeviceId}`);
        }

        // Handle device token registration if we have both user and headers
        if (user && headers && eventDto.firebaseToken) {
            const userAgent = headers[HTTP_HEADERS.USER_AGENT] ?? '';
            const deviceType = this.deviceDetectionService.detectDeviceType(userAgent);

            try {
                await this.deviceTokenService.saveToken(user, eventDto.firebaseToken, deviceType);
                this.logger.debug(
                    `Successfully registered Firebase token for user: ${user.id} with device type: ${deviceType}`,
                );
            } catch (tokenError) {
                this.logger.warn(`Failed to register device token: ${tokenError.message}`);
                // Continue with event creation even if token registration fails
            }
        } // Enrich timezone information only if we have the necessary context
        if (headers || currentEvent || eventDto.timezone) {
            this.enrichEventTimezone(eventDto, headers, currentEvent);
        }
    }

    /**
     * Enrich event data with timezone information
     * @param eventDto The event data to enrich
     * @param headers Optional request headers for timezone detection
     * @param currentEvent Optional current event data for fallback timezone
     */
    private enrichEventTimezone(
        eventDto: any,
        headers?: Record<string, any>,
        currentEvent?: any,
    ): void {
        const originalTimezone = eventDto.timezone;

        // If headers are provided, use them to detect timezone
        if (headers) {
            this.timezoneService.ensureValidTimezone(eventDto, headers);
        }
        // Otherwise validate the provided timezone or use fallbacks
        else if (!eventDto.timezone || !this.timezoneService.isValidTimezone(eventDto.timezone)) {
            this.logger.warn(`Invalid or missing timezone: ${eventDto.timezone}, using fallback`);

            // Use existing timezone from current event if available
            if (
                currentEvent?.timezone &&
                this.timezoneService.isValidTimezone(currentEvent.timezone)
            ) {
                eventDto.timezone = currentEvent.timezone;
            }
            // Fall back to a reasonable default for the region if in development
            else if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'local') {
                eventDto.timezone = 'Asia/Ho_Chi_Minh';
            }
            // Last resort: use default timezone
            else {
                eventDto.timezone = this.timezoneService.DEFAULT_TIMEZONE;
            }
        }

        if (originalTimezone !== eventDto.timezone) {
            this.logger.debug(
                `Timezone changed from ${originalTimezone ?? 'none'} to ${eventDto.timezone}`,
            );
        }
    }
}
