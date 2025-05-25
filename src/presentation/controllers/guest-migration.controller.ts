import {
    Controller,
    Post,
    UseGuards,
    Request,
    Headers,
    Logger,
    BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../infrastructure/auth/guards/jwt-auth.guard';
import { GuestMigrationService } from '../../application/services/users/guest-migration.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';

@ApiTags('guest-migration')
@Controller('guest-migration')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiHeader({ name: 'X-CSRF-Token', description: 'CSRF Token received during login' })
@ApiHeader({
    name: 'X-Device-ID',
    description: 'Device ID to migrate from guest to authenticated user',
})
export class GuestMigrationController {
    private readonly logger = new Logger(GuestMigrationController.name);

    constructor(private readonly guestMigrationService: GuestMigrationService) {}

    @Post()
    @ApiOperation({ summary: 'Migrate guest device data to authenticated user account' })
    @ApiResponse({ status: 200, description: 'Migration successful' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    async migrateGuestToUser(@Request() req, @Headers('X-Device-ID') deviceId: string) {
        if (!deviceId) {
            throw new BadRequestException('X-Device-ID header is required');
        }

        try {
            // Use the authenticated user's ID from the JWT token and the device ID from headers
            const result = await this.guestMigrationService.migrateGuestToUser(
                req.user.id,
                deviceId,
            );
            return {
                success: true,
                message: 'Guest data successfully migrated to authenticated user account',
                ...result,
            };
        } catch (error) {
            this.logger.error(`Failed to migrate guest data: ${error.message}`, error.stack);
            throw new BadRequestException(`Failed to migrate guest data: ${error.message}`);
        }
    }
}
