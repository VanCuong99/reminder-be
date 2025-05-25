// src/infrastructure/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptionsWithRequest } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../../../application/services/users/user.service';
import { JwtPayload } from '../../../shared/types/jwt-payload.interface';
import { Request } from 'express';
import { RedisService } from '../../../infrastructure/cache/redis.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private readonly configService: ConfigService,
        private readonly userService: UserService,
        private readonly redisService: RedisService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                ExtractJwt.fromAuthHeaderAsBearerToken(),
                ExtractJwt.fromUrlQueryParameter('token'),
                (request: Request) => {
                    // Extract from cookie as fallback
                    return request?.cookies?.access_token ?? request?.cookies?.token;
                },
            ]),
            secretOrKey: configService.get<string>('JWT_SECRET'),
            ignoreExpiration: false,
            passReqToCallback: true,
        } as StrategyOptionsWithRequest);
    }

    async validate(req: Request, payload: JwtPayload) {
        try {
            // Check if token is blacklisted
            if (payload.sub && payload.jti) {
                const isBlacklisted = await this.isTokenBlacklisted(payload.sub, payload.jti);
                if (isBlacklisted) {
                    throw new UnauthorizedException('Token has been revoked');
                }
            }

            // Verify CSRF token if not a "safe" method (GET, HEAD, OPTIONS)
            const safeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
            if (!safeMethod && payload.csrf) {
                const csrfToken = req.headers['x-csrf-token'] as string;
                if (!csrfToken || csrfToken !== payload.csrf) {
                    throw new UnauthorizedException('Invalid CSRF token');
                }
            }

            // Find user in the database
            const user = await this.userService.findById(payload.sub);

            // Check if user exists and is active
            if (!user?.isActive) {
                throw new UnauthorizedException('User is inactive or does not exist');
            }

            // Return user data for request context
            return {
                id: user.id,
                email: user.email,
                role: user.role,
                username: user.username,
                tokenId: payload.jti,
            };
        } catch (error) {
            throw new UnauthorizedException('Invalid token', { cause: error });
        }
    }

    /**
     * Check if token has been blacklisted
     */
    private async isTokenBlacklisted(userId: string, tokenId: string): Promise<boolean> {
        try {
            const blacklist = await this.redisService.get(`blacklist:${userId}`);
            if (!blacklist) return false;

            // Handle cases where blacklist might be a string or an array
            if (Array.isArray(blacklist)) {
                return blacklist.includes(tokenId);
            } else if (typeof blacklist === 'string') {
                try {
                    const parsed = JSON.parse(blacklist);
                    return Array.isArray(parsed) && parsed.includes(tokenId);
                } catch {
                    return false;
                }
            }

            return false;
        } catch (error) {
            console.error('Redis blacklist check failed:', error);
            return false; // In case of Redis errors, allow the request
        }
    }
}
