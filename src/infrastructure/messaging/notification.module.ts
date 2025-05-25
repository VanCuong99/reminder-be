import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationService } from './notification.service';
import { Notification } from '../../domain/entities/notification.entity';
import { Event } from '../../domain/entities/event.entity';
import { User } from '../../domain/entities/user.entity';
import { DeviceToken } from '../../domain/entities/device-token.entity';
import { GuestDevice } from '../../domain/entities/guest-device.entity';
import { FirebaseModule } from '../firestore/firebase.module';
import { DeviceTokenModule } from '../../application/services/device-token/device-token.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Notification, Event, User, DeviceToken, GuestDevice]),
        ScheduleModule.forRoot(),
        FirebaseModule,
        DeviceTokenModule,
    ],
    providers: [NotificationService],
    exports: [NotificationService],
})
export class NotificationModule {}
