import { Test, TestingModule } from '@nestjs/testing';
import { TimezoneService } from './timezone.service';
import { timezoneConfig } from '../config/timezone.config';
import { Logger } from '@nestjs/common';

// Mock the timezoneConfig
jest.mock('../config/timezone.config', () => ({
    timezoneConfig: {
        defaultTimezone: 'UTC',
    },
}));

describe('TimezoneService', () => {
    let service: TimezoneService;
    let loggerSpy: jest.SpyInstance;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [TimezoneService],
        }).compile();

        service = module.get<TimezoneService>(TimezoneService);
        loggerSpy = jest.spyOn(service['logger'], 'debug').mockImplementation(() => {});
        jest.spyOn(service['logger'], 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    describe('isValidTimezone', () => {
        it('should return true for valid timezone', () => {
            expect(service.isValidTimezone('America/New_York')).toBe(true);
        });

        it('should return false for invalid timezone', () => {
            expect(service.isValidTimezone('Invalid/Timezone')).toBe(false);
        });
    });

    describe('getTimezoneByLocale', () => {
        it('should return correct timezone for exact locale match', () => {
            expect(service.getTimezoneByLocale('en-US')).toBe('America/New_York');
        });

        it('should return correct timezone based on language part', () => {
            expect(service.getTimezoneByLocale('en-ABC')).toBe('America/New_York');
        });

        it('should return undefined for unknown locale', () => {
            expect(service.getTimezoneByLocale('xx-YY')).toBeUndefined();
        });
    });

    describe('getTimezoneFromHeaders', () => {
        it('should use x-timezone header when present and valid', () => {
            const headers = { 'x-timezone': 'Europe/Berlin' };
            expect(service.getTimezoneFromHeaders(headers)).toBe('Europe/Berlin');
        });

        it('should use timezone from body when header is not present', () => {
            const headers = { body: { timezone: 'Asia/Tokyo' } };
            expect(service.getTimezoneFromHeaders(headers)).toBe('Asia/Tokyo');
        });

        it('should check alternative header names', () => {
            const headers = { timezone: 'Europe/Paris' };
            expect(service.getTimezoneFromHeaders(headers)).toBe('Europe/Paris');
        });

        it('should use timezone from Accept-Language when other sources not available', () => {
            const headers = { 'accept-language': 'ja-JP,en;q=0.9' };
            expect(service.getTimezoneFromHeaders(headers)).toBe('Asia/Tokyo');
        });

        it('should fall back to default timezone when no sources are available', () => {
            const headers = {};
            expect(service.getTimezoneFromHeaders(headers)).toBe(timezoneConfig.defaultTimezone);
        });
        it('should handle errors and return default timezone', () => {
            // Force an error in the process
            jest.spyOn(service, 'isValidTimezone').mockImplementationOnce(() => {
                throw new Error('Test error');
            });

            const headers = { 'x-timezone': 'Europe/Berlin' };
            expect(service.getTimezoneFromHeaders(headers)).toBe(timezoneConfig.defaultTimezone);
        });
    });

    describe('getClientTimezone', () => {
        it('should extract headers from request object', () => {
            const req = { headers: { 'x-timezone': 'Europe/London' } };
            expect(service.getClientTimezone(req)).toBe('Europe/London');
        });

        it('should handle direct headers object', () => {
            const headers = { 'x-timezone': 'Europe/Madrid' };
            expect(service.getClientTimezone(headers)).toBe('Europe/Madrid');
        });

        it('should handle errors and return default timezone', () => {
            jest.spyOn(service, 'getTimezoneFromHeaders').mockImplementationOnce(() => {
                throw new Error('Test error');
            });

            expect(service.getClientTimezone({})).toBe(timezoneConfig.defaultTimezone);
        });
    });
    describe('ensureValidTimezone', () => {
        it('should not modify eventData when timezone is valid', () => {
            const eventData = { timezone: 'Europe/Berlin', name: 'Test Event' };
            const headers = {};

            jest.spyOn(service, 'isValidTimezone').mockReturnValue(true);

            const result = service.ensureValidTimezone(eventData, headers);
            expect(result.timezone).toBe('Europe/Berlin');
        });

        it('should replace invalid timezone with detected timezone', () => {
            const eventData = { timezone: 'Invalid/Zone', name: 'Test Event' };
            const headers = { 'x-timezone': 'Europe/Berlin' };

            // Mock the behavior to correctly simulate the validation flow
            jest.spyOn(service, 'isValidTimezone')
                .mockImplementationOnce(() => false) // Invalid timezone check returns false
                .mockReturnValue(true); // Other timezone checks return true

            jest.spyOn(service, 'getClientTimezone').mockReturnValue('Europe/Berlin');

            const result = service.ensureValidTimezone(eventData, headers);
            expect(result.timezone).toBe('Europe/Berlin');
        });

        it('should set timezone when none is provided', () => {
            const eventData = { name: 'Test Event' };
            const headers = { 'x-timezone': 'Asia/Tokyo' };

            jest.spyOn(service, 'getClientTimezone').mockReturnValue('Asia/Tokyo');

            const result = service.ensureValidTimezone(eventData, headers);
            expect(result.timezone).toBe('Asia/Tokyo');
        });
    });
});
