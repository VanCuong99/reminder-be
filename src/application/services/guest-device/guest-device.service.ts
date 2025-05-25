import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GuestDevice } from '../../../domain/entities/guest-device.entity';
import { TokenValidationService } from '../../../shared/services/token-validation.service';
import { TimezoneService } from '../../../shared/services/timezone.service';
import { DeviceFingerprintingService } from '../../../shared/services/device-fingerprinting.service';

@Injectable()
export class GuestDeviceService {
    private readonly logger = new Logger(GuestDeviceService.name);

    constructor(
        @InjectRepository(GuestDevice)
        private readonly guestDeviceRepository: Repository<GuestDevice>,
        private readonly tokenValidationService: TokenValidationService,
        private readonly timezoneService: TimezoneService,
        private readonly deviceFingerprintingService: DeviceFingerprintingService,
    ) {}

    /**
     * Find or create a guest device by deviceId
     */
    async findOrCreate(
        deviceId: string,
        firebaseToken?: string,
        timezone?: string,
    ): Promise<GuestDevice> {
        try {
            // Try to find existing guest device
            let guestDevice = await this.guestDeviceRepository.findOne({
                where: { deviceId },
            });

            // If not found, create new guest device
            if (!guestDevice) {
                guestDevice = this.guestDeviceRepository.create({
                    deviceId,
                    firebaseToken,
                    timezone,
                    isActive: true,
                });
                await this.guestDeviceRepository.save(guestDevice);
                this.logger.log(`Created new guest device with ID: ${deviceId}`);
            } else if (
                (firebaseToken && guestDevice.firebaseToken !== firebaseToken) ||
                (timezone && guestDevice.timezone !== timezone)
            ) {
                // Update token or timezone if provided and different
                if (firebaseToken) {
                    guestDevice.firebaseToken = firebaseToken;
                }
                if (timezone) {
                    guestDevice.timezone = timezone;
                }
                await this.guestDeviceRepository.save(guestDevice);
                this.logger.log(`Updated guest device: ${deviceId}`);
            }

            return guestDevice;
        } catch (error) {
            this.logger.error(`Error finding/creating guest device: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Update guest device
     */
    async update(deviceId: string, data: Partial<GuestDevice>): Promise<GuestDevice> {
        const device = await this.guestDeviceRepository.findOne({
            where: { deviceId },
        });

        if (!device) {
            throw new NotFoundException(`Guest device with ID ${deviceId} not found`);
        }

        Object.assign(device, data);
        return this.guestDeviceRepository.save(device);
    }

    /**
     * Get guest device by deviceId
     */
    async findByDeviceId(deviceId: string): Promise<GuestDevice> {
        const device = await this.guestDeviceRepository.findOne({
            where: { deviceId },
        });

        if (!device) {
            throw new NotFoundException(`Guest device with ID ${deviceId} not found`);
        }

        return device;
    }

    /**
     * Register a Firebase token for a guest device
     */
    async registerDeviceToken(
        deviceId: string | null,
        headers: Record<string, any>,
        firebaseToken: string,
        providedTimezone?: string,
    ): Promise<{ guestDevice: GuestDevice; deviceId: string; needsDeviceId: boolean }> {
        let needsDeviceId = !deviceId;

        // Auto-generate deviceId if not provided
        if (needsDeviceId) {
            const userAgent = headers['user-agent'] ?? 'unknown-agent';
            const clientIp = headers['x-forwarded-for'] ?? 'unknown-ip';

            // Generate a device ID
            deviceId = this.deviceFingerprintingService.generateFingerprint(userAgent, clientIp);
            this.logger.debug(`Auto-generated device ID: ${deviceId}`);
        }

        // Get timezone from headers or provided value
        let timezone = providedTimezone;

        // If timezone not provided, detect from headers
        if (!timezone) {
            const enrichedHeaders = { ...headers, body: { timezone } };
            timezone = this.timezoneService.getClientTimezone(enrichedHeaders);
        }

        // Validate the Firebase token format
        this.tokenValidationService.validateFirebaseToken(firebaseToken);

        // Register the device with the Firebase token
        const guestDevice = await this.findOrCreate(deviceId, firebaseToken, timezone);

        this.logger.log(`Registered Firebase token for guest device ${deviceId}`);

        return {
            guestDevice,
            deviceId,
            needsDeviceId,
        };
    }
}
