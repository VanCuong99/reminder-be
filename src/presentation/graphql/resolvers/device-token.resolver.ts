import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../infrastructure/auth/guards/jwt-auth.guard';
import { DeviceTokenService } from '../../../application/services/device-token/device-token.service';
import { DeviceTokenType } from '../types/device-token/outputs/device-token.type';
import { RegisterDeviceTokenInput } from '../types/device-token/inputs/register-device-token.input';
import { CurrentUser } from '../../../infrastructure/auth/decorators/current-user.decorator';
import { User } from '../../../domain/entities/user.entity';

@Resolver(() => DeviceTokenType)
@UseGuards(JwtAuthGuard)
export class DeviceTokenResolver {
    constructor(private readonly deviceTokenService: DeviceTokenService) {}

    @Mutation(() => DeviceTokenType)
    async registerDeviceToken(
        @Args('input') input: RegisterDeviceTokenInput,
        @CurrentUser() user: User,
    ): Promise<DeviceTokenType> {
        return this.deviceTokenService.saveToken(user, input.token, input.deviceType);
    }

    @Mutation(() => Boolean)
    async deactivateDeviceToken(
        @Args('token') token: string,
        @CurrentUser() user: User,
    ): Promise<boolean> {
        await this.deviceTokenService.deactivateToken(token);
        return true;
    }

    @Query(() => [DeviceTokenType])
    async myDeviceTokens(@CurrentUser() user: User): Promise<DeviceTokenType[]> {
        return this.deviceTokenService.getUserActiveTokens(user.id);
    }

    @Query(() => [DeviceTokenType])
    async userDeviceTokens(@Args('userId') userId: string): Promise<DeviceTokenType[]> {
        return this.deviceTokenService.getUserActiveTokens(userId);
    }
}
