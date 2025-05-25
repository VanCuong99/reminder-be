// src/app.module.ts
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import * as Joi from 'joi';
import { ScheduleModule } from '@nestjs/schedule';

// Auth & Security
import { AuthModule } from './infrastructure/auth/auth.module';
import { RolesGuard } from './infrastructure/auth/guards/roles.guard';
import { MaintenanceMiddleware } from './infrastructure/auth/middleware/maintenance.middleware';

// Infrastructure
import { CacheModule } from './infrastructure/cache/cache.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { FirebaseModule } from './infrastructure/firestore/firebase.module';
import { NotificationModule } from './infrastructure/messaging/notification.module';

// Entities
import { User } from './domain/entities/user.entity';
import { DeviceToken } from './domain/entities/device-token.entity';
import { Event } from './domain/entities/event.entity';
import { Notification } from './domain/entities/notification.entity';
import { GuestDevice } from './domain/entities/guest-device.entity';

// Application Services
import { GuestDeviceModule } from './application/services/guest-device/guest-device.module';
import { ReminderModule } from './application/services/notifications/reminder.module';
import { EventNotificationModule } from './application/services/notifications/event-notification.module';
import { GuestMigrationModule } from './application/services/users/guest-migration.module';

// Shared Services
import { SharedServicesModule } from './shared/services/shared-services.module';

// Presentation
import { ControllersModule } from './presentation/controllers.module';

@Module({
    imports: [
        // Configuration with validation
        ConfigModule.forRoot({
            isGlobal: true,
            validationSchema: Joi.object({
                // Database
                DB_HOST: Joi.string().default('localhost'),
                DB_PORT: Joi.number().default(5432),
                DB_USERNAME: Joi.string().required(),
                DB_PASSWORD: Joi.string().required(),
                DB_NAME: Joi.string().required(),

                // Server
                PORT: Joi.number().default(3001),
                NODE_ENV: Joi.string()
                    .valid('development', 'production', 'test')
                    .default('development'),

                // JWT Config
                JWT_PRIVATE_KEY: Joi.string().required(),
                JWT_PUBLIC_KEY: Joi.string().required(),
                JWT_ALGORITHM: Joi.string().default('RS256'),
                JWT_EXPIRATION: Joi.string().default('1h'),
                JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),

                // Firebase Config - allow either FIREBASE_CONFIG or individual fields
                FIREBASE_CONFIG: Joi.string().optional(),
                FIREBASE_PROJECT_ID: Joi.string().optional(),
                FIREBASE_CLIENT_EMAIL: Joi.string().optional(),
                FIREBASE_PRIVATE_KEY: Joi.string().optional(),

                // Redis
                REDIS_HOST: Joi.string().default('localhost'),
                REDIS_PORT: Joi.number().default(6379),

                // Rate limiting
                THROTTLE_TTL: Joi.number().default(60),
                THROTTLE_LIMIT: Joi.number().default(10),
            }),
            envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
        }),

        // Scheduler for recurring tasks
        ScheduleModule.forRoot(),

        // Database
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                type: 'postgres',
                host: configService.get('DB_HOST'),
                port: configService.get<number>('DB_PORT'),
                username: configService.get('DB_USERNAME'),
                password: configService.get('DB_PASSWORD'),
                database: configService.get('DB_NAME'),
                entities: [User, DeviceToken, Event, Notification, GuestDevice],
                synchronize: configService.get('NODE_ENV') !== 'production',
                logging: configService.get('NODE_ENV') === 'development',
                ssl:
                    configService.get('NODE_ENV') === 'production'
                        ? { rejectUnauthorized: false }
                        : false,
            }),
        }),

        // Rate limiting
        ThrottlerModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => [
                {
                    ttl: configService.get<number>('THROTTLE_TTL', 60),
                    limit: configService.get<number>('THROTTLE_LIMIT', 10),
                },
            ],
        }),

        // Infrastructure modules
        DatabaseModule,
        CacheModule,
        FirebaseModule,
        NotificationModule,

        // Shared services
        SharedServicesModule,

        // Auth
        AuthModule,

        // Application Services
        GuestDeviceModule,
        ReminderModule,
        EventNotificationModule,
        GuestMigrationModule,

        // Controllers
        ControllersModule,
    ],
    providers: [
        // Global rate limiting guard
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
        // Global roles guard for RBAC
        {
            provide: APP_GUARD,
            useClass: RolesGuard,
        },
    ],
})
export class AppModule implements NestModule {
    // Configure middleware for maintenance mode
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(MaintenanceMiddleware).forRoutes('*');
    }
}
