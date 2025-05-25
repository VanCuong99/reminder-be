import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuestDevice } from '../../../domain/entities/guest-device.entity';
import { GuestDeviceService } from './guest-device.service';

@Module({
    imports: [TypeOrmModule.forFeature([GuestDevice])],
    providers: [GuestDeviceService],
    exports: [GuestDeviceService],
})
export class GuestDeviceModule {}
