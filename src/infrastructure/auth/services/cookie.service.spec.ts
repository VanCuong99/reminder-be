import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { CookieService } from './cookie.service';
import { AUTH_CONSTANTS } from '../../../shared/constants/auth.constants';

describe('CookieService', () => {
    let service: CookieService;
    let mockResponse: jest.Mocked<Response>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [CookieService],
        }).compile();

        service = module.get<CookieService>(CookieService);
        mockResponse = {
            cookie: jest.fn(),
            clearCookie: jest.fn(),
        } as any;
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('setAuthCookie', () => {
        it('should set a cookie with secure settings', () => {
            service.setAuthCookie(mockResponse, 'test_cookie', 'test_value', 3600000);

            expect(mockResponse.cookie).toHaveBeenCalledWith(
                'test_cookie',
                'test_value',
                expect.objectContaining({
                    ...AUTH_CONSTANTS.COOKIE,
                    maxAge: 3600000,
                    path: '/',
                }),
            );
        });
    });

    describe('clearAuthCookie', () => {
        it('should clear a cookie with secure settings', () => {
            service.clearAuthCookie(mockResponse, 'test_cookie');
            expect(mockResponse.clearCookie).toHaveBeenCalledWith(
                'test_cookie',
                expect.objectContaining({
                    ...AUTH_CONSTANTS.COOKIE,
                    path: '/',
                }),
            );
        });
    });

    describe('setAuthCookies', () => {
        it('should set all auth cookies with correct expiry', () => {
            const tokens = {
                accessToken: 'test_access_token',
                refreshToken: 'test_refresh_token',
                csrfToken: 'test_csrf_token',
            };

            service.setAuthCookies(mockResponse, tokens); // Access token cookie
            expect(mockResponse.cookie).toHaveBeenCalledWith(
                'access_token',
                tokens.accessToken,
                expect.objectContaining({
                    ...AUTH_CONSTANTS.COOKIE,
                    maxAge: expect.any(Number),
                }),
            );

            // Refresh token cookie
            expect(mockResponse.cookie).toHaveBeenCalledWith(
                'refresh_token',
                tokens.refreshToken,
                expect.objectContaining({
                    ...AUTH_CONSTANTS.COOKIE,
                    maxAge: expect.any(Number),
                }),
            );

            // CSRF token cookie
            expect(mockResponse.cookie).toHaveBeenCalledWith(
                'csrf_token',
                tokens.csrfToken,
                expect.objectContaining({
                    ...AUTH_CONSTANTS.COOKIE,
                    maxAge: expect.any(Number),
                }),
            );
        });
    });

    describe('clearAuthCookies', () => {
        it('should clear all auth cookies', () => {
            service.clearAuthCookies(mockResponse);
            expect(mockResponse.clearCookie).toHaveBeenCalledWith(
                'access_token',
                expect.objectContaining({
                    ...AUTH_CONSTANTS.COOKIE,
                    path: '/',
                }),
            );
            expect(mockResponse.clearCookie).toHaveBeenCalledWith(
                'refresh_token',
                expect.objectContaining({
                    ...AUTH_CONSTANTS.COOKIE,
                    path: '/',
                }),
            );
            expect(mockResponse.clearCookie).toHaveBeenCalledWith(
                'csrf_token',
                expect.objectContaining({
                    ...AUTH_CONSTANTS.COOKIE,
                    path: '/',
                }),
            );
        });
    });

    describe('parseExpiryToMs', () => {
        it('should correctly parse different time units', () => {
            const service = new CookieService();
            const parseExpiryToMs = (service as any).parseExpiryToMs.bind(service);

            expect(parseExpiryToMs('7d')).toBe(7 * 24 * 60 * 60 * 1000); // 7 days
            expect(parseExpiryToMs('24h')).toBe(24 * 60 * 60 * 1000); // 24 hours
            expect(parseExpiryToMs('30m')).toBe(30 * 60 * 1000); // 30 minutes
            expect(parseExpiryToMs('60s')).toBe(60 * 1000); // 60 seconds
            expect(parseExpiryToMs('invalid')).toBe(0); // Invalid format
        });
    });
});
