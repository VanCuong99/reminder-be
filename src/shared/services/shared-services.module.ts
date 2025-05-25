import { Module } from '@nestjs/common';
import { TimezoneService } from './timezone.service';
import { DeviceDetectionService } from './device-detection.service';
import { DeviceFingerprintingService } from './device-fingerprinting.service';
import { TokenValidationService } from './token-validation.service';
import { EventEnrichmentService } from './event-enrichment.service';
import { DeviceTokenModule } from '../../application/services/device-token/device-token.module';

@Module({
    imports: [DeviceTokenModule],
    providers: [
        TimezoneService,
        DeviceDetectionService,
        DeviceFingerprintingService,
        TokenValidationService,
        EventEnrichmentService,
    ],
    exports: [
        TimezoneService,
        DeviceDetectionService,
        DeviceFingerprintingService,
        TokenValidationService,
        EventEnrichmentService,
    ],
})
export class SharedServicesModule {}
