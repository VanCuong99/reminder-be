import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../cache/redis.service';
import { JwtPayload } from '../../../shared/types/jwt-payload.interface';

@Injectable()
export class JwtMiddleware implements NestMiddleware {
    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly redisService: RedisService,
    ) {}

    async use(req: Request, res: Response, next: NextFunction) {
        // Extract token from various sources with precedence
        const token = this.extractToken(req);
        const csrfToken = req.headers['x-csrf-token'] as string;

        if (!token) {
            return res.status(401).json({ code: 'AUTH_FAILED', message: 'No JWT token found' });
        }

        try {
            // 1. Verify JWT signature + expiration
            const payload = this.jwtService.verify<JwtPayload>(token, {
                secret:
                    this.configService.get<string>('JWT_PUBLIC_KEY') ||
                    this.configService.get<string>('JWT_SECRET'),
                algorithms: ['RS256'],
            });

            // 2. Check if token has required fields
            if (!payload.sub) {
                return res.status(401).json({
                    code: 'AUTH_FAILED',
                    message: 'Invalid token format',
                });
            }

            // 3. Check Redis blacklist (if jti is present)
            if (payload.jti) {
                const isBlacklisted = await this.isTokenBlacklisted(payload.sub, payload.jti);
                if (isBlacklisted) {
                    return res.status(401).json({
                        code: 'AUTH_FAILED',
                        message: 'Token has been revoked',
                    });
                }
            }

            // 4. Validate CSRF token for non-safe methods (if csrf in token)
            const safeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
            if (payload.csrf && !safeMethod && (!csrfToken || csrfToken !== payload.csrf)) {
                return res.status(401).json({
                    code: 'AUTH_FAILED',
                    message: 'Invalid CSRF token',
                });
            }

            // Attach user to request
            req.user = {
                id: payload.sub,
                email: payload.email,
                role: payload.role || payload.roles?.[0],
                roles: payload.roles,
                tokenId: payload.jti,
            };

            next();
        } catch (error) {
            return res.status(401).json({
                code: 'AUTH_FAILED',
                message: 'Invalid JWT token',
                details:
                    this.configService.get('NODE_ENV') === 'development'
                        ? error.message
                        : undefined,
            });
        }
    }

    private extractToken(req: Request): string | null {
        // Check Authorization header
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }

        // Check cookies
        if (req.cookies?.access_token) {
            return req.cookies.access_token;
        }

        // Check old cookie name for backward compatibility
        if (req.cookies?.jwt) {
            return req.cookies.jwt;
        }

        // Check query parameter
        if (req.query?.token && typeof req.query.token === 'string') {
            return req.query.token;
        }

        return null;
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

            // Handle both array and string formats
            if (Array.isArray(blacklistedTokens)) {
                return blacklistedTokens.includes(tokenId);
            } else if (typeof blacklistedTokens === 'string') {
                try {
                    const parsed = JSON.parse(blacklistedTokens);
                    return Array.isArray(parsed) && parsed.includes(tokenId);
                } catch (error) {
                    console.error('Error parsing blacklisted tokens:', error);
                    return false;
                }
            }

            return false;
        } catch (error) {
            // In case Redis is down, default to allowing the token
            console.error('Redis error when checking blacklisted token:', error);
            return false;
        }
    }
}
