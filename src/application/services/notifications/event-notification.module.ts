import { Module } from '@nestjs/common';
import { EventNotificationService } from './event-notification.service';
import { NotificationModule } from '../../../infrastructure/messaging/notification.module';
import { UserModule } from '../../../presentation/user.module';
import { GuestDeviceModule } from '../guest-device/guest-device.module';
import { FirebaseModule } from '../../../infrastructure/firestore/firebase.module';
import { DeviceTokenModule } from '../device-token/device-token.module';

@Module({
    imports: [NotificationModule, UserModule, GuestDeviceModule, FirebaseModule, DeviceTokenModule],
    providers: [EventNotificationService],
    exports: [EventNotificationService],
})
export class EventNotificationModule {}
