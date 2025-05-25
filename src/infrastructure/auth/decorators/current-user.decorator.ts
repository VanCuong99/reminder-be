// current-user.decorator.ts
import {
    createParamDecorator,
    ExecutionContext,
    UnauthorizedException,
    Logger,
} from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

const logger = new Logger('CurrentUserDecorator');

/**
 * Extract the current user from various authentication methods:
 * - From request.user (set by JwtAuthGuard)
 * - Directly from access_token cookie
 * - From Authorization header (both with and without Bearer prefix)
 * - From query parameter access_token
 */
export const extractCurrentUser = (context: ExecutionContext): any | undefined => {
    try {
        // Only work with HTTP context
        if (context.getType() !== 'http') {
            logger.debug('Context is not HTTP');
            return undefined;
        }

        const request = context.switchToHttp().getRequest<Request>();
        if (!request) {
            logger.debug('No HTTP request found in context');
            return undefined;
        }

        // If user is already attached by JwtAuthGuard
        if (request.user) {
            logger.debug('User already attached to request');
            return request.user;
        }

        // Try to extract token from various sources
        let token: string | undefined;

        // From Authorization header (could be with or without Bearer prefix)
        const authHeader = request.headers.authorization;
        if (authHeader) {
            logger.debug('Found authorization header');
            if (authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7); // Remove 'Bearer ' prefix
                logger.debug('Extracted token from Bearer prefix');
            } else {
                token = authHeader;
                logger.debug('Using raw authorization header as token');
            }
        }

        // From cookies if not found in header
        if (!token && request.cookies?.access_token) {
            token = request.cookies.access_token;
            logger.debug('Extracted token from cookies');
        }

        // From query params if still not found
        if (
            !token &&
            request.query.access_token &&
            typeof request.query.access_token === 'string'
        ) {
            token = request.query.access_token;
            logger.debug('Extracted token from query parameter');
        }

        if (!token) {
            logger.debug('No authentication token found in request');
            return undefined; // Changed from throw to return undefined
        }

        try {
            // First try with JWT_SECRET (symmetric key)
            const jwtSecret = process.env.JWT_SECRET;
            if (jwtSecret) {
                try {
                    logger.debug('Attempting to verify with JWT_SECRET');
                    const decoded = jwt.verify(token, jwtSecret);
                    logger.debug('Token verified successfully with JWT_SECRET');
                    return decoded;
                } catch (err) {
                    logger.debug(`JWT_SECRET verification failed: ${err.message}`);
                    // Continue to try with public key if symmetric key fails
                }
            }

            // Then try with JWT_PUBLIC_KEY (asymmetric key)
            const jwtPublicKey = process.env.JWT_PUBLIC_KEY;
            if (jwtPublicKey) {
                try {
                    logger.debug('Attempting to verify with JWT_PUBLIC_KEY');
                    const decoded = jwt.verify(token, jwtPublicKey, { algorithms: ['RS256'] });
                    logger.debug('Token verified successfully with JWT_PUBLIC_KEY');
                    return decoded;
                } catch (err) {
                    logger.debug(`JWT_PUBLIC_KEY verification failed: ${err.message}`);
                }
            }

            // If we get here, both verification methods failed
            logger.warn('Token verification failed with both JWT_SECRET and JWT_PUBLIC_KEY');
            return undefined;
        } catch (error) {
            logger.error(`Token verification error: ${error.message}`);
            return undefined;
        }
    } catch (error) {
        logger.error(`Error in CurrentUser decorator: ${error.message}`);
        return undefined;
    }
};

/**
 * Custom decorator to extract the current user from various authentication methods
 * Optionally extract a specific property from the user object
 */
export const CurrentUser = createParamDecorator(
    (propertyPath: string | undefined, ctx: ExecutionContext) => {
        const user = extractCurrentUser(ctx);

        // If no user or no property path specified, return the entire user object
        if (!user || !propertyPath) {
            return user;
        }

        // Handle nested properties like 'profile.name'
        const properties = propertyPath.split('.');
        return properties.reduce((obj, prop) => obj && obj[prop], user);
    },
);
