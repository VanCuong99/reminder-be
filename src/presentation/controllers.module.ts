import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

// Controllers
import { AuthController } from './controllers/auth.controller';
import { DeviceTokenController } from './controllers/device-token.controller';
import { EventController } from './controllers/event.controller';
import { GuestEventController } from './controllers/guest-event.controller';
import { HealthController } from './controllers/health.controller';
import { NotificationController } from './controllers/notification.controller';
import { GuestNotificationController } from './controllers/guest-notification.controller';
import { GuestMigrationController } from './controllers/guest-migration.controller';
import { GuestDeviceTokenController } from './controllers/guest-device-token.controller';

// Modules
import { AuthModule } from '../infrastructure/auth/auth.module';
import { DeviceTokenModule } from '../application/services/device-token/device-token.module';
import { EventModule } from '../application/services/events/event.module';
import { UserModule } from './user.module';
import { NotificationModule } from '../infrastructure/messaging/notification.module';
import { GuestDeviceModule } from '../application/services/guest-device/guest-device.module';
import { GuestMigrationModule } from '../application/services/users/guest-migration.module';
import { UsersController } from './controllers/users.controller';
import { FirebaseModule } from '../infrastructure/firestore/firebase.module';
import { SharedServicesModule } from '../shared/services/shared-services.module';

// Entities
import { User } from '../domain/entities/user.entity';

@Module({
    imports: [
        ConfigModule,
        TypeOrmModule.forFeature([User]), // Add User entity for repository injection
        AuthModule.forRoot(),
        DeviceTokenModule,
        EventModule,
        NotificationModule,
        UserModule,
        GuestDeviceModule,
        GuestMigrationModule,
        FirebaseModule,
        SharedServicesModule,
    ],
    controllers: [
        AuthController,
        DeviceTokenController,
        EventController,
        GuestEventController,
        HealthController,
        NotificationController,
        GuestNotificationController,
        GuestMigrationController,
        UsersController,
        GuestDeviceTokenController,
    ],
})
export class ControllersModule {}
