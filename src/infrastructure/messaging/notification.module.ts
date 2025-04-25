import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationService } from './notification.service';
import { DeviceTokenModule } from '../../application/services/device-token/device-token.module';
import { NotificationResolver } from '../../presentation/graphql/resolvers/notification.resolver';
import { DeviceToken } from '../../domain/entities/device-token.entity';

@Module({
    imports: [ConfigModule, TypeOrmModule.forFeature([DeviceToken]), DeviceTokenModule],
    providers: [NotificationService, NotificationResolver],
    exports: [NotificationService],
})
export class NotificationModule {}
