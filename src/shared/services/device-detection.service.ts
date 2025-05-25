import { Injectable, Logger } from '@nestjs/common';

/**
 * Service for detecting device types from user agents
 */
@Injectable()
export class DeviceDetectionService {
    private readonly logger = new Logger(DeviceDetectionService.name);

    /**
     * Detect device type from user agent string
     * @param userAgent The user agent string
     * @returns Device type (ANDROID, IOS, WEB, OTHER)
     */
    detectDeviceType(userAgent: string): string {
        userAgent = (userAgent || '').toLowerCase();

        if (userAgent.includes('android')) {
            return 'ANDROID';
        } else if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
            return 'IOS';
        } else if (
            userAgent.includes('mozilla') ||
            userAgent.includes('chrome') ||
            userAgent.includes('safari')
        ) {
            return 'WEB';
        }

        return 'OTHER';
    }
}
