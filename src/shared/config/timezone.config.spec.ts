import { Logger } from '@nestjs/common';

describe('timezoneConfig', () => {
    // Silence all logger output for all tests
    let loggerErrorSpy: jest.SpyInstance;
    let loggerDebugSpy: jest.SpyInstance;
    let loggerWarnSpy: jest.SpyInstance;
    let loggerLogSpy: jest.SpyInstance;
    beforeAll(() => {
        loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
        loggerDebugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
        loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
        loggerLogSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    });
    afterAll(() => {
        loggerErrorSpy.mockRestore();
        loggerDebugSpy.mockRestore();
        loggerWarnSpy.mockRestore();
        loggerLogSpy.mockRestore();
    });
    const OLD_ENV = process.env;
    let originalConsoleWarn: any;
    let originalConsoleLog: any;

    beforeEach(() => {
        jest.resetModules(); // Clears the cache
        process.env = { ...OLD_ENV };
        originalConsoleWarn = console.warn;
        originalConsoleLog = console.log;
        console.warn = jest.fn();
        console.log = jest.fn();
    });

    afterEach(() => {
        process.env = OLD_ENV;
        console.warn = originalConsoleWarn;
        console.log = originalConsoleLog;
    });

    it('should use Asia/Ho_Chi_Minh as default in development', () => {
        process.env.NODE_ENV = 'development';
        jest.resetModules();
        const { timezoneConfig } = require('./timezone.config');
        expect(timezoneConfig.defaultTimezone).toBe('Asia/Ho_Chi_Minh');
        expect(timezoneConfig.forceDefaultTimezone).toBe(false);
    });

    it('should use UTC as default in production', () => {
        process.env.NODE_ENV = 'production';
        jest.resetModules();
        const { timezoneConfig } = require('./timezone.config');
        expect(timezoneConfig.defaultTimezone).toBe('UTC');
        expect(timezoneConfig.forceDefaultTimezone).toBe(false);
    });

    it('should use UTC and forceDefaultTimezone in test', () => {
        process.env.NODE_ENV = 'test';
        jest.resetModules();
        const { timezoneConfig } = require('./timezone.config');
        expect(timezoneConfig.defaultTimezone).toBe('UTC');
        expect(timezoneConfig.forceDefaultTimezone).toBe(true);
    });

    it('should use forced timezone from environment variable', () => {
        process.env.FORCE_TIMEZONE = 'Asia/Tokyo';
        jest.resetModules();
        const { timezoneConfig } = require('./timezone.config');
        expect(timezoneConfig.defaultTimezone).toBe('Asia/Tokyo');
        expect(timezoneConfig.forceDefaultTimezone).toBe(true);
        expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining('Using forced timezone from environment: Asia/Tokyo'),
        );
    });

    it('should throw and warn if forced timezone is invalid', () => {
        process.env.FORCE_TIMEZONE = 'Invalid/Timezone';
        jest.resetModules();
        expect(() => require('./timezone.config')).toThrow();
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining('Invalid forced timezone: Invalid/Timezone'),
        );
    });
});
