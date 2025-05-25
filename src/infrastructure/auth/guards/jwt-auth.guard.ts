// src/infrastructure/auth/guards/jwt-auth.guard.ts
import { ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    private readonly logger = new Logger(JwtAuthGuard.name);

    constructor(private readonly jwtService: JwtService) {
        super();
    }

    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        const request = context.switchToHttp().getRequest();
        const token = this.extractToken(request);

        // Debug logging
        this.logger.debug(`JWT Guard activated for path: ${request.path}`);
        this.logger.debug(`Token extraction result: ${token ? 'Found token' : 'No token found'}`);

        if (!token) {
            this.logger.warn(`No token found in request for path: ${request.path}`);
            throw new UnauthorizedException('Authentication token is missing');
        }

        // Do a preliminary verification to provide better error messages
        try {
            // This just decodes without verification to check format
            this.jwtService.decode(token);
        } catch (error) {
            this.logger.warn(`Invalid token format: ${error.message}`);
            throw new UnauthorizedException('Invalid authentication token format');
        }

        // Delegate to the Passport strategy for full verification
        return super.canActivate(context);
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
            return request?.query.access_token;
        }

        return null;
    }

    handleRequest(err, user, info) {
        if (err || !user) {
            const errorMessage = err?.message ?? info?.message ?? 'Unauthorized access';
            this.logger.warn(`Authentication failed: ${errorMessage}`);
            throw new UnauthorizedException(errorMessage);
        }
        return user;
    }
}
