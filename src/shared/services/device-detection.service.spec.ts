import { Logger } from '@nestjs/common';
import { DeviceDetectionService } from './device-detection.service';

describe('DeviceDetectionService', () => {
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

    let service: DeviceDetectionService;

    beforeEach(() => {
        service = new DeviceDetectionService();
    });

    it('should return ANDROID for Android user agents', () => {
        expect(service.detectDeviceType('Mozilla/5.0 (Linux; Android 10; SM-G970F)')).toBe(
            'ANDROID',
        );
        expect(service.detectDeviceType('android')).toBe('ANDROID');
    });

    it('should return IOS for iPhone/iPad user agents', () => {
        expect(
            service.detectDeviceType('Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X)'),
        ).toBe('IOS');
        expect(service.detectDeviceType('Mozilla/5.0 (iPad; CPU OS 13_2_3 like Mac OS X)')).toBe(
            'IOS',
        );
        expect(service.detectDeviceType('iphone')).toBe('IOS');
        expect(service.detectDeviceType('ipad')).toBe('IOS');
    });

    it('should return WEB for browser user agents', () => {
        expect(
            service.detectDeviceType(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/58.0.3029.110 Safari/537.3',
            ),
        ).toBe('WEB');
        expect(service.detectDeviceType('chrome')).toBe('WEB');
        expect(service.detectDeviceType('safari')).toBe('WEB');
        expect(service.detectDeviceType('mozilla')).toBe('WEB');
    });

    it('should return OTHER for unknown user agents', () => {
        expect(service.detectDeviceType('unknown-device')).toBe('OTHER');
        expect(service.detectDeviceType('')).toBe('OTHER');
        expect(service.detectDeviceType(undefined as any)).toBe('OTHER');
        expect(service.detectDeviceType(null as any)).toBe('OTHER');
    });
});
