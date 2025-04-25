import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceTokenService } from './device-token.service';
import { DeviceToken } from '../../../domain/entities/device-token.entity';
import { DeviceTokenResolver } from '../../../presentation/graphql/resolvers/device-token.resolver';

@Module({
    imports: [TypeOrmModule.forFeature([DeviceToken])],
    providers: [DeviceTokenService, DeviceTokenResolver],
    exports: [DeviceTokenService],
})
export class DeviceTokenModule {}
