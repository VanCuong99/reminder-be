import { Test, TestingModule } from '@nestjs/testing';
import { ControllersModule } from './controllers.module';
import { AuthController } from './controllers/auth.controller';
import { DeviceTokenController } from './controllers/device-token.controller';
import { EventController } from './controllers/event.controller';
import { GuestEventController } from './controllers/guest-event.controller';
import { HealthController } from './controllers/health.controller';
import { NotificationController } from './controllers/notification.controller';
import { GuestNotificationController } from './controllers/guest-notification.controller';
import { GuestMigrationController } from './controllers/guest-migration.controller';
import { GuestDeviceTokenController } from './controllers/guest-device-token.controller';
import { UsersController } from './controllers/users.controller';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { User } from '../domain/entities/user.entity';
import { Event } from '../domain/entities/event.entity';
import { DeviceToken } from '../domain/entities/device-token.entity';
import { Notification } from '../domain/entities/notification.entity';
import { GuestDevice } from '../domain/entities/guest-device.entity';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { SocialAccount } from '../domain/entities/social-account.entity';
import { JwtConfigService } from '../infrastructure/auth/services/jwt-config.service';
import { EventService } from '../application/services/events/event.service';
import { ReminderService } from '../application/services/notifications/reminder.service';
import { GuestDeviceService } from '../application/services/guest-device/guest-device.service';
import { FirebaseService } from '../infrastructure/firestore/firebase.service';
import { TimezoneService } from '../shared/services/timezone.service';
import { DeviceTokenService } from '../application/services/device-token/device-token.service';
import { NotificationService } from '../infrastructure/messaging/notification.service';

describe('ControllersModule', () => {
    let module: TestingModule;

    const mockRepository = {
        find: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    };
    const mockDataSource = {
        initialize: jest.fn(),
        destroy: jest.fn(),
        manager: {},
        getRepository: jest.fn().mockReturnValue(mockRepository),
    };

    beforeEach(async () => {
        const builder = Test.createTestingModule({
            imports: [ConfigModule.forRoot({ isGlobal: true }), ControllersModule],
            providers: [{ provide: DataSource, useValue: mockDataSource }],
        })
            .overrideProvider(getRepositoryToken(User))
            .useValue(mockRepository)
            .overrideProvider(getRepositoryToken(Event))
            .useValue(mockRepository)
            .overrideProvider(getRepositoryToken(DeviceToken))
            .useValue(mockRepository)
            .overrideProvider(getRepositoryToken(Notification))
            .useValue(mockRepository)
            .overrideProvider(getRepositoryToken(GuestDevice))
            .useValue(mockRepository)
            .overrideProvider(getRepositoryToken(SocialAccount))
            .useValue(mockRepository)
            .overrideProvider(DataSource)
            .useValue(mockDataSource)
            .overrideProvider(ConfigService)
            .useValue({
                get: (key: string) => {
                    if (key === 'JWT_PUBLIC_KEY') return 'test-public-key';
                    // Add more keys as needed
                    return 'test-value';
                },
            })
            .overrideProvider(JwtConfigService)
            .useValue({
                secret: 'test-secret',
                secretOrKey: 'test-secret',
                secretOrPublicKey: 'test-secret',
                algorithm: 'HS256',
                getSecret: () => 'test-secret',
                getSecretOrKey: () => 'test-secret',
                getAlgorithm: () => 'HS256',
            });
        builder
            .overrideProvider(EventService)
            .useValue({})
            .overrideProvider(ReminderService)
            .useValue({})
            .overrideProvider(GuestDeviceService)
            .useValue({})
            .overrideProvider(FirebaseService)
            .useValue({})
            .overrideProvider(TimezoneService)
            .useValue({})
            .overrideProvider(DeviceTokenService)
            .useValue({})
            .overrideProvider(NotificationService)
            .useValue({});
        module = await builder.compile();
    });

    it('should compile the module', () => {
        expect(module).toBeDefined();
    });

    it('should provide all controllers', () => {
        expect(module.get(AuthController)).toBeDefined();
        expect(module.get(DeviceTokenController)).toBeDefined();
        expect(module.get(EventController)).toBeDefined();
        expect(module.get(GuestEventController)).toBeDefined();
        expect(module.get(HealthController)).toBeDefined();
        expect(module.get(NotificationController)).toBeDefined();
        expect(module.get(GuestNotificationController)).toBeDefined();
        expect(module.get(GuestMigrationController)).toBeDefined();
        expect(module.get(UsersController)).toBeDefined();
        expect(module.get(GuestDeviceTokenController)).toBeDefined();
    });
});
