import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../application/services/auth/auth.service';
import {
    AuthResponse,
    UserResponse,
} from '../../application/interfaces/auth/auth-response.interface';
import { AuthSuccessResponse } from '../../presentation/interfaces/auth.interface';
import { AuthProvider, AUTH_CONSTANTS } from '../constants/auth.constants';
import { CookieService } from '../../infrastructure/auth/services/cookie.service';

/**
 * Service for validating various types of tokens
 */
@Injectable()
export class TokenValidationService {
    private readonly logger = new Logger(TokenValidationService.name);

    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService,
        private readonly cookieService: CookieService,
    ) {}

    /**
     * Validate a Firebase Cloud Messaging token
     * @param token The Firebase token to validate
     * @throws BadRequestException if the token is invalid
     */
    validateFirebaseToken(token: string): void {
        if (!token) {
            throw new BadRequestException('Firebase token is required');
        }

        // Firebase Cloud Messaging tokens are usually long base64 strings
        if (token.length < 100 || !/^[A-Za-z0-9_-]+$/.test(token)) {
            this.logger.warn(
                `Invalid Firebase token format detected: ${token.substring(0, 10)}...`,
            );
            throw new BadRequestException('Invalid Firebase token format');
        }
    }

    /**
     * Extract token from authorization header
     * @param authorization The authorization header value
     * @returns The extracted token or null if not found
     */
    extractTokenFromAuthHeader(authorization: string): string | null {
        try {
            if (authorization?.startsWith('Bearer ')) {
                return authorization.substring(7);
            } else if (authorization) {
                return authorization;
            }
            return null;
        } catch (error) {
            this.logger.error(`Error extracting token: ${error.message}`);
            return null;
        }
    }

    /**
     * Extract token from request object
     * @param request Express request object
     * @returns The extracted token or null if not found
     */ extractTokenFromRequest(request: any): string | null {
        return this.extractTokenFromAuthHeader(request.headers.authorization);
    }

    /**
     * Extract access token from cookies or authorization header
     */
    extractAccessToken(req: Request): string | null {
        let accessToken = req.cookies['access_token'];

        accessToken ??= this.extractTokenFromRequest(req);

        if (!accessToken) {
            this.logger.warn('No access token found in request');
            return null;
        }

        return accessToken;
    }

    /**
     * Extract refresh token from cookies or request body
     */
    extractRefreshToken(req: Request, body?: { refreshToken?: string }): string | null {
        let refreshToken = req.cookies['refresh_token'];

        if (!refreshToken && body?.refreshToken) {
            this.logger.debug('Using refresh token from request body');
            refreshToken = body.refreshToken;
        }

        if (!refreshToken) {
            this.logger.warn('No refresh token found in request');
            return null;
        }

        return refreshToken;
    }

    /**
     * Validate and decode a token, extracting user ID and token ID
     */
    validateAndDecodeToken(token: string): { userId?: string; tokenId?: string } | null {
        try {
            const decoded = this.authService.decodeToken(token);

            if (!(decoded?.sub && decoded?.jti)) {
                this.logger.warn('Invalid token structure - missing required claims');
                return null;
            }

            return {
                userId: decoded.sub,
                tokenId: decoded.jti,
            };
        } catch (error) {
            this.logger.error(`Token validation failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Set authentication cookies in the response
     * @param res Express Response object
     * @param accessToken Access token to set
     * @param refreshToken Refresh token to set
     * @param isProduction Whether the environment is production
     */
    setAuthCookies(
        res: Response,
        accessToken: string,
        refreshToken: string,
        isProduction: boolean,
    ): void {
        const cookieOptions: {
            httpOnly: boolean;
            secure: boolean;
            sameSite: 'strict' | 'lax' | 'none';
        } = {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'strict' : 'lax',
        };

        // For test compatibility, use 'access_token' and 'refresh_token' as cookie names
        res.cookie('access_token', accessToken, cookieOptions);
        res.cookie('refresh_token', refreshToken, cookieOptions);
    }

    /**
     * Clear authentication cookies from the response
     * @param res Express Response object
     */
    clearAuthCookies(res: Response): void {
        // For test compatibility, use 'access_token' and 'refresh_token' as cookie names
        res.cookie('access_token', '', { expires: new Date(0) });
        res.cookie('refresh_token', '', { expires: new Date(0) });
    }

    /**
     * Handles the auth response by setting cookies and formatting the response
     * @param res Express Response object
     * @param authResponse Auth response from the service
     * @param provider Optional provider name for message customization
     * @returns Formatted auth success response
     */ handleAuthResponse(
        res: Response,
        authResponse: AuthResponse,
        provider?: AuthProvider,
    ): AuthSuccessResponse {
        // Set auth cookies using cookie service
        const isProduction = this.configService.get('NODE_ENV') === 'production';
        this.setAuthCookies(
            res,
            authResponse.tokens.accessToken,
            authResponse.tokens.refreshToken,
            isProduction,
        );

        // Determine message based on provider
        const message = !provider
            ? AUTH_CONSTANTS.MESSAGES[AuthProvider.LOCAL]
            : (AUTH_CONSTANTS.MESSAGES[provider] ?? AUTH_CONSTANTS.MESSAGES[AuthProvider.LOCAL]);

        // Return success response with tokens and message
        return {
            user: authResponse.user,
            accessToken: authResponse.tokens.accessToken,
            refreshToken: authResponse.tokens.refreshToken,
            csrfToken: authResponse.tokens.csrfToken,
            message,
        };
    }

    /**
     * Transform user entity to safe response object
     */
    private transformUserResponse(user: any): UserResponse {
        return {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
        };
    }

    /**
     * Transform user entity to profile response object
     */
    transformProfileResponse(user: any): { success: boolean; user: any; isAuthenticated: boolean } {
        if (!user) {
            return { success: false, user: null, isAuthenticated: false };
        }

        const userResponse = {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
            isActive: user.isActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };

        return {
            success: true,
            user: userResponse,
            isAuthenticated: true,
        };
    } /**
     * Get appropriate success message based on auth provider
     */
    private getSuccessMessage(provider?: AuthProvider): string {
        if (!provider) {
            return AUTH_CONSTANTS.MESSAGES[AuthProvider.LOCAL];
        }
        return AUTH_CONSTANTS.MESSAGES[provider] ?? AUTH_CONSTANTS.MESSAGES[AuthProvider.LOCAL];
    }

    /**
     * Validate and transform social auth user data
     * @throws UnauthorizedException if social profile data is incomplete
     */ validateAndTransformSocialUser(user: any): {
        socialId: string;
        email: string;
        name: string;
        avatar?: string;
        provider: AuthProvider;
    } {
        if (!user?.socialId || !user?.name || !user?.email || !user?.provider) {
            this.logger.warn('Incomplete social profile data received');
            throw new UnauthorizedException('Incomplete social profile data');
        }

        return {
            socialId: user.socialId,
            email: user.email,
            name: user.name,
            avatar: user.avatar, // Changed from user.profile?.avatar to user.avatar
            provider: user.provider,
        };
    }
}
