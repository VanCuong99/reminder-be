import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventService } from './event.service';
import { Event } from '../../../domain/entities/event.entity';
import { User } from '../../../domain/entities/user.entity';
import { GuestDevice } from '../../../domain/entities/guest-device.entity';
import { DeviceToken } from '../../../domain/entities/device-token.entity';
import { FirebaseModule } from '../../../infrastructure/firestore/firebase.module';
import { GuestDeviceModule } from '../guest-device/guest-device.module';
import { ReminderModule } from '../notifications/reminder.module';
import { DeviceTokenModule } from '../device-token/device-token.module';
import { NotificationModule } from '../../../infrastructure/messaging/notification.module';
import { SharedServicesModule } from '../../../shared/services/shared-services.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Event, User, GuestDevice, DeviceToken]),
        FirebaseModule,
        GuestDeviceModule,
        ReminderModule,
        DeviceTokenModule,
        NotificationModule,
        SharedServicesModule,
    ],
    providers: [EventService],
    exports: [EventService],
})
export class EventModule {}
