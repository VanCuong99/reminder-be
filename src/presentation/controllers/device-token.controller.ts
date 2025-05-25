import { Body, Controller, Delete, Get, Param, Post, UseGuards, Logger, Req } from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
    ApiHeader,
} from '@nestjs/swagger';
import { DeviceTokenService } from '../../application/services/device-token/device-token.service';
import { JwtAuthGuard } from '../../infrastructure/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../infrastructure/auth/decorators/current-user.decorator';
import { User } from '../../domain/entities/user.entity';
import { RegisterDeviceTokenDto } from '../dto/device-token/register-device-token.dto';
import { ApiResponseDto } from '../dto/common/responses/api-response.dto';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { TokenValidationService } from '../../shared/services/token-validation.service';

@ApiTags('Device Tokens')
@ApiBearerAuth()
@Controller('device-tokens')
@UseGuards(JwtAuthGuard)
@ApiHeader({
    name: 'X-CSRF-Token',
    description: 'CSRF Token received during login (required for non-GET requests)',
})
export class DeviceTokenController {
    private readonly logger = new Logger(DeviceTokenController.name);

    constructor(
        private readonly deviceTokenService: DeviceTokenService,
        private readonly jwtService: JwtService,
        private readonly tokenValidationService: TokenValidationService,
    ) {}

    @ApiOperation({ summary: 'Register a new device token' })
    @ApiResponse({
        status: 201,
        description: 'Device token registered successfully',
        type: ApiResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Invalid input' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing authentication' })
    @Post()
    async registerDeviceToken(
        @Body() registerDeviceTokenDto: RegisterDeviceTokenDto,
        @CurrentUser() user: User,
        @Req() request: Request,
    ) {
        if (!user) {
            throw new Error('User is required');
        }
        try {
            // Debugging to check token issues
            this.extractTokenFromRequest(request); // Just for logging
            this.logger.debug(
                `Processing device token registration for user ${user.id}, token type: ${registerDeviceTokenDto.deviceType}`,
            );
            this.logger.debug(`Authorization header present: ${!!request.headers.authorization}`);
            this.logger.debug(`CSRF token present: ${!!request.headers['x-csrf-token']}`);

            return await this.deviceTokenService.saveToken(
                user,
                registerDeviceTokenDto.token,
                registerDeviceTokenDto.deviceType,
            );
        } catch (error) {
            this.logger.error(`Failed to register device token: ${error.message}`, error.stack);
            throw error;
        }
    }

    // Extract token from request using TokenValidationService
    private extractTokenFromRequest(request: Request): string | null {
        try {
            return this.tokenValidationService.extractTokenFromRequest(request);
        } catch (error) {
            this.logger.error(`Error extracting token: ${error?.message ?? error}`);
            return null;
        }
    }

    @ApiOperation({ summary: 'Deactivate a device token' })
    @ApiParam({ name: 'token', description: 'Device token to deactivate' })
    @ApiResponse({
        status: 200,
        description: 'Device token deactivated successfully',
        type: ApiResponseDto,
    })
    @ApiResponse({ status: 404, description: 'Token not found' })
    @Delete(':token')
    async deactivateDeviceToken(
        @Param('token') token: string,
        @CurrentUser() user: User,
        @Req() request: Request,
    ) {
        if (!user) {
            throw new Error('User is required');
        }
        this.logger.debug(`Deactivating token ${token} for user ${user.id}`);
        await this.deviceTokenService.deactivateToken(token);
        return { success: true };
    }

    @ApiOperation({ summary: 'Get all active device tokens for the current user' })
    @ApiResponse({
        status: 200,
        description: "Returns list of user's device tokens",
        type: ApiResponseDto,
    })
    @Get('my')
    async myDeviceTokens(@CurrentUser() user: User, @Req() request: Request) {
        if (!user) {
            throw new Error('User is required');
        }
        this.logger.debug(`Getting tokens for current user ${user.id}`);
        return this.deviceTokenService.getUserActiveTokens(user.id);
    }

    @ApiOperation({ summary: 'Get all active device tokens for a specific user' })
    @ApiParam({ name: 'userId', description: 'ID of the user' })
    @ApiResponse({
        status: 200,
        description: "Returns list of user's device tokens",
        type: ApiResponseDto,
    })
    @ApiResponse({ status: 404, description: 'User not found' })
    @Get('user/:userId')
    async userDeviceTokens(@Param('userId') userId: string, @Req() request: Request) {
        if (!userId) {
            return undefined;
        }
        this.logger.debug(`Getting tokens for user ID ${userId}`);
        return this.deviceTokenService.getUserActiveTokens(userId);
    }
}
