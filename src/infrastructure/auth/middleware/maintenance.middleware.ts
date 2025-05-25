import { Injectable, NestMiddleware, ServiceUnavailableException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../cache/redis.service';

@Injectable()
export class MaintenanceMiddleware implements NestMiddleware {
    private readonly MAINTENANCE_KEY = 'sistema:maintenance';

    constructor(
        private readonly configService: ConfigService,
        private readonly redisService: RedisService,
    ) {}

    async use(req: Request, res: Response, next: NextFunction) {
        // Skip maintenance check for health endpoint
        if (req.path === '/health') {
            return next();
        }

        try {
            // Check if maintenance mode is enabled in Redis
            const maintenanceMode = await this.redisService.get(this.MAINTENANCE_KEY);

            if (maintenanceMode === 'true') {
                const maintenanceMessage =
                    (await this.redisService.get(`${this.MAINTENANCE_KEY}:message`)) ||
                    'System is under maintenance. Please try again later.';

                throw new ServiceUnavailableException(maintenanceMessage);
            }

            next();
        } catch (error) {
            if (error instanceof ServiceUnavailableException) {
                throw error;
            }

            // If Redis is down, check environment variable as fallback
            const fallbackMaintenanceMode =
                this.configService.get<string>('MAINTENANCE_MODE') === 'true';

            if (fallbackMaintenanceMode) {
                throw new ServiceUnavailableException(
                    'System is under maintenance. Please try again later.',
                );
            }

            next();
        }
    }
}
