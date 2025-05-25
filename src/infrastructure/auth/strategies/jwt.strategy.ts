import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';
import { RedisService } from '../../cache/redis.service';
import { UserService } from '../../../application/services/users/user.service';
import { JwtPayload } from '../../../shared/types/jwt-payload.interface';
import { JwtConfigService } from '../services/jwt-config.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    private readonly logger = new Logger(JwtStrategy.name);

    constructor(
        private readonly jwtConfigService: JwtConfigService,
        private readonly redisService: RedisService,
        private readonly userService: UserService,
    ) {
        const staticLogger = new Logger(JwtStrategy.name);
        staticLogger.log(`Initializing JWT strategy with algorithm: ${jwtConfigService.algorithm}`);

        super({
            jwtFromRequest: request => {
                try {
                    // Check Authorization header with Bearer prefix
                    const authHeader = request.headers.authorization;
                    if (authHeader?.startsWith('Bearer ')) {
                        return authHeader.substring(7);
                    }

                    // Check raw Authorization header without Bearer prefix
                    if (authHeader) {
                        return authHeader;
                    }

                    // Check for token in cookies
                    if (request.cookies?.access_token) {
                        return request.cookies.access_token;
                    }

                    // Check query parameter as last resort
                    if (request.query?.access_token) {
                        return typeof request.query.access_token === 'string'
                            ? request.query.access_token
                            : null;
                    }

                    return null;
                } catch (error) {
                    staticLogger.error(`Error extracting JWT: ${error.message}`);
                    return null;
                }
            },
            secretOrKey: jwtConfigService.secretOrPublicKey,
            algorithms: [jwtConfigService.algorithm],
            ignoreExpiration: false,
            passReqToCallback: true,
        });

        this.logger.log(`JWT Strategy initialized with algorithm ${jwtConfigService.algorithm}`);
    }

    async validate(req: Request, payload: JwtPayload): Promise<any> {
        this.logger.debug(
            `JWT validation attempt for payload: ${JSON.stringify({
                sub: payload?.sub,
                email: payload?.email,
                role: payload?.role,
                hasJti: !!payload?.jti,
            })}`,
        );

        try {
            // Check if token is blacklisted (user logged out)
            if (payload.jti) {
                const isBlacklisted = await this.isTokenBlacklisted(payload.sub, payload.jti);
                if (isBlacklisted) {
                    this.logger.warn(`Token ${payload.jti} is blacklisted for user ${payload.sub}`);
                    throw new UnauthorizedException('Token revoked');
                }
            }

            // CSRF check only for state-changing operations (not for GET requests)
            if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && payload.csrf) {
                const csrfToken = req.headers['x-csrf-token'] as string;

                // Skip CSRF check for API clients
                const isApiClient =
                    req.headers['user-agent']?.includes('PostmanRuntime') ||
                    req.headers['user-agent']?.includes('Swagger') ||
                    req.get('origin') === null; // No origin = API call

                if (csrfToken !== payload.csrf && !isApiClient) {
                    this.logger.warn(
                        `CSRF token mismatch: expected=${payload.csrf}, received=${csrfToken}`,
                    );
                    throw new UnauthorizedException('Invalid CSRF token');
                }
            }

            // Get user with role-based permissions
            this.logger.debug(`Looking up user with ID: ${payload.sub}`);
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

            this.logger.debug(`JWT validated successfully for user ${user.email}`);

            // Return combined user data and relevant token information
            return {
                ...user,
                // Preserve the original token claims that are needed for operations
                sub: payload.sub, // User ID from token
                jti: payload.jti, // Token ID needed for blacklisting
                csrf: payload.csrf, // CSRF token for validation
            };
        } catch (error) {
            this.logger.error(`JWT validation error: ${error.message}`);
            throw new UnauthorizedException(error.message);
        }
    }

    private async isTokenBlacklisted(userId: string, tokenId: string): Promise<boolean> {
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
