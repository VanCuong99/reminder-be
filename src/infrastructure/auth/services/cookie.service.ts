import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { AUTH_CONSTANTS } from '../../../shared/constants/auth.constants';

@Injectable()
export class CookieService {
    /**
     * Sets an authentication cookie with secure settings
     */
    setAuthCookie(res: Response, name: string, value: string, maxAge?: number, path = '/'): void {
        res.cookie(name, value, {
            ...AUTH_CONSTANTS.COOKIE,
            maxAge,
            path,
        });
    }

    /**
     * Clears an authentication cookie
     */
    clearAuthCookie(res: Response, name: string, path = '/'): void {
        res.clearCookie(name, {
            ...AUTH_CONSTANTS.COOKIE,
            path,
        });
    }

    /**
     * Sets standard authentication cookies (access token, refresh token, CSRF)
     */
    setAuthCookies(
        res: Response,
        {
            accessToken,
            refreshToken,
            csrfToken,
        }: {
            accessToken: string;
            refreshToken: string;
            csrfToken: string;
        },
    ): void {
        // Access token - shorter expiry
        this.setAuthCookie(
            res,
            'access_token',
            accessToken,
            this.parseExpiryToMs(AUTH_CONSTANTS.TOKEN_SETTINGS.ACCESS_TOKEN_EXPIRY),
        );

        // Refresh token - longer expiry
        this.setAuthCookie(
            res,
            'refresh_token',
            refreshToken,
            this.parseExpiryToMs(AUTH_CONSTANTS.TOKEN_SETTINGS.REFRESH_TOKEN_EXPIRY),
        );

        // CSRF token - same expiry as access token
        this.setAuthCookie(
            res,
            'csrf_token',
            csrfToken,
            this.parseExpiryToMs(AUTH_CONSTANTS.TOKEN_SETTINGS.ACCESS_TOKEN_EXPIRY),
        );
    }

    /**
     * Clears all authentication cookies
     */
    clearAuthCookies(res: Response): void {
        this.clearAuthCookie(res, 'access_token');
        this.clearAuthCookie(res, 'refresh_token');
        this.clearAuthCookie(res, 'csrf_token');
    }

    /**
     * Parse JWT-style expiry string (e.g., '7d', '24h', '30m') to milliseconds
     */
    private parseExpiryToMs(expiry: string): number {
        // Check if the string matches the expected format: number followed by d, h, m, or s
        if (!/^\d+[dhms]$/.test(expiry)) {
            return 0; // Return 0 for invalid format
        }

        const unit = expiry.slice(-1);
        const value = parseInt(expiry.slice(0, -1));

        switch (unit) {
            case 'd':
                return value * 24 * 60 * 60 * 1000;
            case 'h':
                return value * 60 * 60 * 1000;
            case 'm':
                return value * 60 * 1000;
            case 's':
                return value * 1000;
            default:
                return 0; // Default to session cookie
        }
    }
}
