import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuestDevice } from '../../../domain/entities/guest-device.entity';
import { GuestDeviceService } from './guest-device.service';
import { SharedServicesModule } from '../../../shared/services/shared-services.module';

@Module({
    imports: [TypeOrmModule.forFeature([GuestDevice]), SharedServicesModule],
    providers: [GuestDeviceService],
    exports: [GuestDeviceService],
})
export class GuestDeviceModule {}
