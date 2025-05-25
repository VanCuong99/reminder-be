import { Module } from '@nestjs/common';
import { ReminderService } from './reminder.service';
import { CacheModule } from '../../../infrastructure/cache/cache.module';
import { FirebaseModule } from '../../../infrastructure/firestore/firebase.module';
import { NotificationModule } from '../../../infrastructure/messaging/notification.module';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../../../domain/entities/event.entity';

@Module({
    imports: [
        ScheduleModule.forRoot(),
        TypeOrmModule.forFeature([Event]),
        CacheModule,
        FirebaseModule,
        NotificationModule,
    ],
    providers: [ReminderService],
    exports: [ReminderService],
})
export class ReminderModule {}
