import { Controller, Get, Post, Body, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { Public } from '../../infrastructure/auth/decorators/public.decorator';
import { JwtAuthGuard } from '../../infrastructure/auth/guards/jwt-auth.guard';
import { Roles } from '../../infrastructure/auth/decorators/role.decorator';
import { UserRole } from '../../shared/constants/user-role.enum';
import { User } from '../../domain/entities/user.entity';
import { FirebaseService } from '../../infrastructure/firestore/firebase.service';

interface HealthStatus {
    status: 'ok' | 'error';
    timestamp: string;
    services: {
        database: {
            status: 'ok' | 'error';
            message?: string;
        };
        redis: {
            status: 'ok' | 'error';
            message?: string;
        };
        firebase: {
            status: 'ok' | 'error';
            message?: string;
        };
    };
    maintenance: boolean;
    version: string;
}

interface MaintenanceDto {
    enabled: boolean;
    message?: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
    private readonly MAINTENANCE_KEY = 'sistema:maintenance';
    private readonly logger = new Logger(HealthController.name);

    constructor(
        @InjectRepository(User) private readonly userRepository: Repository<User>,
        private readonly redisService: RedisService,
        private readonly firebaseService: FirebaseService,
    ) {}

    @Public()
    @Get()
    @ApiOperation({ summary: 'Check system health' })
    @ApiResponse({ status: 200, description: 'Health status of all components' })
    async check(): Promise<HealthStatus> {
        const status: HealthStatus = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            services: {
                database: { status: 'ok' },
                redis: { status: 'ok' },
                firebase: { status: 'ok' },
            },
            maintenance: false,
            version: process.env.npm_package_version || '1.0.0',
        };

        // Check database connection
        try {
            await this.userRepository.count();
        } catch (error: any) {
            status.services.database = {
                status: 'error',
                message: `Database connection error: ${error?.message ?? 'Connection failed'}`,
            };
            status.status = 'error';
            throw new Error(error);
        }

        // Check Redis connection
        try {
            await this.redisService.set('health:check', 'ok', 5);
            const result = await this.redisService.get('health:check');

            if (result !== 'ok') throw new Error('Redis read/write check failed');

            // Check maintenance mode
            const maintenanceMode = await this.redisService.get(this.MAINTENANCE_KEY);
            status.maintenance = maintenanceMode === 'true';
        } catch (error: any) {
            status.services.redis = {
                status: 'error',
                message: `Could not connect to Redis: ${error.message ?? 'Unknown error'}`,
            };
            status.status = 'error';
            return status; // Return immediately on Redis error since it's a critical service
        }

        // Check Firebase connection
        try {
            const firestore = this.firebaseService.getFirestore();

            // Perform a simple operation just to check connectivity
            // This doesn't create any collections or documents
            try {
                // Just list collections to test connectivity without requiring specific permissions
                // and without creating any new collections or documents
                await firestore.listCollections();
                this.logger.debug('Firebase connection successful - collections can be accessed');
                status.services.firebase = {
                    status: 'ok',
                    message: 'Firebase connection successful - collections can be accessed',
                };
                status.status = 'ok';
            } catch (error) {
                // If listing collections fails, it's likely a permission issue
                this.logger.warn(`Basic Firestore operation failed: ${error.message}`);
                status.services.firebase = {
                    status: 'error',
                    message: `Firestore operation failed: ${error.message ?? 'Unknown error'}`,
                };
                status.status = 'error';
            }
        } catch (error) {
            status.services.firebase = {
                status: 'error',
                message: `Could not connect to Firebase: ${error.message ?? 'Unknown error'}`,
            };
            status.status = 'error';
        }

        return status;
    }

    @Post('maintenance')
    @UseGuards(JwtAuthGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Enable or disable maintenance mode' })
    @ApiResponse({ status: 200, description: 'Maintenance mode updated' })
    async toggleMaintenance(
        @Body() maintenanceDto: MaintenanceDto,
    ): Promise<{ success: boolean; message: string }> {
        try {
            await this.redisService.set(
                this.MAINTENANCE_KEY,
                maintenanceDto.enabled ? 'true' : 'false',
            );

            if (maintenanceDto.enabled && maintenanceDto.message) {
                await this.redisService.set(
                    `${this.MAINTENANCE_KEY}:message`,
                    maintenanceDto.message,
                );
            }

            return {
                success: true,
                message: maintenanceDto.enabled
                    ? 'Maintenance mode enabled'
                    : 'Maintenance mode disabled',
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to update maintenance mode: ${error.message}`,
            };
        }
    }
}
