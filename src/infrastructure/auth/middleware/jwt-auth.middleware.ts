import { Injectable, NestMiddleware, UnauthorizedException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { MILLISECONDS_PER_DAY } from '../../../shared/constants/constants';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthMiddleware implements NestMiddleware {
    private readonly publicKey: string;
    private readonly logger = new Logger(JwtAuthMiddleware.name);
    private readonly publicPaths = [
        '/api/v1/health',
        '/api/v1/auth/login',
        '/api/v1/auth/register',
        '/api/v1/auth/refresh',
        '/health',
        '/',
        '/api/docs',
    ];

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) {
        // Get public key directly from environment variables
        this.publicKey = this.configService.get<string>('JWT_PUBLIC_KEY');

        if (!this.publicKey) {
            this.logger.error(
                'Failed to load public key: No JWT_PUBLIC_KEY found in environment variables',
            );
            throw new Error('Failed to initialize JWT authentication middleware');
        }
    }

    async use(req: Request, res: Response, next: NextFunction) {
        // Check if the path is public and should be excluded from authentication
        const path = req.path;

        // Check if the current path matches any of our public paths
        // or starts with /api/docs/ (for Swagger documentation)
        if (this.isPublicPath(path)) {
            this.logger.debug(`Skipping authentication for public path: ${path}`);
            return next();
        }

        // Extract JWT token from HTTP-only cookie
        const token = req.cookies?.['access_token'];

        if (!token) {
            this.logger.debug(`No authentication token provided for path: ${path}`);
            throw new UnauthorizedException('No authentication token provided');
        }

        try {
            // Verify token with RS256 algorithm
            const payload = await this.jwtService.verifyAsync(token, {
                publicKey: this.publicKey,
                algorithms: ['RS256'],
            });

            // Assign user info to request object
            req['user'] = {
                id: payload.sub,
                email: payload.email,
                role: payload.role,
                jti: payload.jti,
                csrf: payload.csrf,
            };

            // Check token expiration and refresh if needed
            if (this.shouldRefreshToken(payload.exp)) {
                await this.refreshToken(req, res, payload);
            }

            next();
        } catch (error) {
            res.clearCookie('access_token');
            this.logger.error(`Token verification failed: ${error.message}`);
            throw new UnauthorizedException('Invalid or expired authentication token');
        }
    }

    /**
     * Check if the given path is a public path that doesn't require authentication
     */
    private isPublicPath(path: string): boolean {
        if (this.publicPaths.includes(path)) {
            return true;
        }

        // Check for Swagger documentation paths that start with /api/docs/
        if (path.startsWith('/api/docs/')) {
            return true;
        }

        return false;
    }

    /**
     * Check if token should be refreshed (less than 15 minutes until expiration)
     */
    private shouldRefreshToken(expiration: number): boolean {
        const currentTime = Math.floor(Date.now() / 1000);
        const timeUntilExpiration = expiration - currentTime;
        return timeUntilExpiration < 15 * 60; // 15 minutes
    }

    /**
     * Refresh token and set new HTTP-only cookie
     */
    private async refreshToken(req: Request, res: Response, payload: any): Promise<void> {
        // Create new token with extended expiration
        const newToken = await this.jwtService.signAsync(
            {
                sub: payload.sub,
                email: payload.email,
                roles: payload.roles ?? [],
            },
            {
                expiresIn: this.configService.get<string>('JWT_EXPIRATION', '1d'),
                algorithm: 'RS256',
            },
        );

        // Set HTTP-only secure cookie with new token (using access_token instead of auth_token)
        const secure = this.configService.get<string>('NODE_ENV') !== 'development';

        res.cookie('access_token', newToken, {
            httpOnly: true,
            secure: secure,
            sameSite: 'strict',
            maxAge: MILLISECONDS_PER_DAY, // 1 day in milliseconds
            path: '/',
        });
    }
}
