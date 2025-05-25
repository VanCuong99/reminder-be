import { Module } from '@nestjs/common';
import { EventNotificationService } from './event-notification.service';
import { NotificationService } from '../../../infrastructure/messaging/notification.service';
import { UserService } from '../users/user.service';
import { GuestDeviceService } from '../guest-device/guest-device.service';

@Module({
    providers: [EventNotificationService, NotificationService, UserService, GuestDeviceService],
    exports: [EventNotificationService],
})
export class EventNotificationModule {}
