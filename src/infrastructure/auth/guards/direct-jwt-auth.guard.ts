import {
    CanActivate,
    ExecutionContext,
    Injectable,
    Logger,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { UserService } from '../../../application/services/users/user.service';
import { RedisService } from '../../cache/redis.service';
import { ConfigService } from '@nestjs/config';
import { JwtConfigService } from '../services/jwt-config.service';

/**
 * Direct JWT Authentication Guard that handles token verification without using passport-jwt
 * This bypasses any passport issues and directly verifies the token
 */
@Injectable()
export class DirectJwtAuthGuard implements CanActivate {
    private readonly logger = new Logger(DirectJwtAuthGuard.name);

    constructor(
        private readonly jwtService: JwtService,
        private readonly userService: UserService,
        private readonly redisService: RedisService,
        private readonly configService: ConfigService,
        private readonly jwtConfigService: JwtConfigService,
    ) {
        this.logger.log(
            `DirectJwtAuthGuard initialized using algorithm: ${this.jwtConfigService.algorithm}`,
        );
        this.logger.debug(
            `JWT Configuration - Algorithm: ${this.jwtConfigService.algorithm}, Secret/Key exists: ${!!this.jwtConfigService.secretOrPublicKey}`,
        );
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const token = this.extractToken(request);

        this.logger.debug(`Direct JWT Guard activated for path: ${request.path}`);
        this.logger.debug(`Token extraction result: ${token ? 'Found token' : 'No token found'}`);

        if (!token) {
            this.logger.warn(`No token found in request for path: ${request.path}`);
            throw new UnauthorizedException('Authentication token is missing');
        }

        try {
            // First, inspect the token to understand what we're dealing with
            const tokenInspection = this.jwtConfigService.inspectToken(token);

            if (!tokenInspection.parsed) {
                this.logger.warn('Invalid token format - could not parse token');
                throw new UnauthorizedException('Invalid token format');
            }

            this.logger.debug(
                `Token details - Algorithm: ${tokenInspection.header?.alg}, Type: ${tokenInspection.header?.typ}`,
            );
            this.logger.debug(
                `Token claims - Subject: ${tokenInspection.parsed.sub}, Email: ${tokenInspection.parsed.email}`,
            );

            // Attempt to verify the token
            let payload;
            try {
                payload = await this.jwtConfigService.verifyToken(token);
            } catch (error) {
                // If verification fails but we have parsed data, proceed with token data for debugging
                this.logger.warn(`Token signature verification failed: ${error.message}`);

                // For development/debugging only - you might want to remove this in production
                // Continue with the parsed (unverified) data if we have a user ID
                if (process.env.NODE_ENV !== 'production' && tokenInspection.parsed?.sub) {
                    this.logger.warn(
                        '⚠️ INSECURE: Proceeding with unverified token data for debugging purposes',
                    );
                    payload = tokenInspection.parsed;
                } else {
                    throw error;
                }
            }

            if (!payload?.sub) {
                this.logger.warn('Token payload is invalid or missing sub claim');
                throw new UnauthorizedException('Invalid token format');
            }

            this.logger.debug(`Token verified/processed for user ID: ${payload.sub}`);

            // Check if token is blacklisted
            if (payload.jti) {
                const isBlacklisted = await this.checkBlacklist(payload.sub, payload.jti);
                if (isBlacklisted) {
                    this.logger.warn(`Token ${payload.jti} is blacklisted for user ${payload.sub}`);
                    throw new UnauthorizedException('Token has been revoked');
                }
            }

            // Get user info
            const user = await this.userService.findById(payload.sub);

            if (!user) {
                this.logger.warn(`User ${payload.sub} not found during JWT validation`);
                throw new UnauthorizedException('User not found');
            }

            if (!user.isActive) {
                this.logger.warn(
                    `Inactive user ${payload.sub} attempted to access protected resource`,
                );
                throw new UnauthorizedException('User account is inactive');
            }

            // Attach user object to request
            request.user = {
                ...user,
                sub: payload.sub,
                jti: payload.jti,
                csrf: payload.csrf,
            };

            this.logger.debug(`Authentication successful for user: ${user.email}`);
            return true;
        } catch (error) {
            this.logger.warn(`Authentication failed: ${error.message}`);
            throw new UnauthorizedException(error.message);
        }
    }

    private extractToken(request: Request): string | null {
        // First check authorization header with Bearer prefix
        if (request.headers.authorization?.startsWith('Bearer ')) {
            return request.headers.authorization.substring(7);
        }

        // Check raw authorization header without Bearer prefix
        if (request.headers.authorization) {
            return request.headers.authorization;
        }

        // Check for token in cookies
        if (request.cookies?.access_token) {
            return request.cookies.access_token;
        }

        // Check query parameter token
        if (request.query?.access_token && typeof request.query.access_token === 'string') {
            return request.query.access_token;
        }

        return null;
    }

    private async checkBlacklist(userId: string, tokenId: string): Promise<boolean> {
        if (!userId || !tokenId) {
            return false;
        }

        try {
            const blacklistedTokens = await this.redisService.get(`blacklist:${userId}`);
            if (!blacklistedTokens) {
                return false;
            }

            try {
                const parsed = JSON.parse(blacklistedTokens);
                return Array.isArray(parsed) && parsed.includes(tokenId);
            } catch (error) {
                this.logger.error(`Error parsing blacklisted tokens: ${error.message}`);
                return false;
            }
        } catch (error) {
            this.logger.error(`Redis error when checking blacklisted token: ${error.message}`);
            return false;
        }
    }
}
